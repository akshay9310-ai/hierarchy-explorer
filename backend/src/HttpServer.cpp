#include "HttpServer.hpp"
#include "Json.hpp"
#include <fstream>
#include <set>
#include <windows.h>
#include <iostream>
#include <sstream>
#include <algorithm>
#include <cctype>
#include <cstdlib>
#include <exception>
#include <unordered_map>
#include <vector>

namespace {

std::string jsonEscape(const std::string& value) {
    std::ostringstream out;
    for (unsigned char ch : value) {
        switch (ch) {
            case '"': out << "\\\""; break;
            case '\\': out << "\\\\"; break;
            case '\b': out << "\\b"; break;
            case '\f': out << "\\f"; break;
            case '\n': out << "\\n"; break;
            case '\r': out << "\\r"; break;
            case '\t': out << "\\t"; break;
            default:
                if (ch < 0x20) {
                    const char* hex = "0123456789abcdef";
                    out << "\\u00" << hex[(ch >> 4) & 0x0f] << hex[ch & 0x0f];
                } else out << static_cast<char>(ch);
        }
    }
    return out.str();
}

std::string trim(const std::string& value) {
    const size_t start = value.find_first_not_of(" \t\r\n");
    if (start == std::string::npos) return "";
    return value.substr(start, value.find_last_not_of(" \t\r\n") - start + 1);
}

std::string lowerCopy(std::string value) {
    std::transform(value.begin(), value.end(), value.begin(),
                   [](unsigned char ch) { return static_cast<char>(std::tolower(ch)); });
    return value;
}

std::string urlDecode(const std::string& value) {
    std::string decoded;
    for (size_t i = 0; i < value.size(); ++i) {
        if (value[i] == '%' && i + 2 < value.size()) {
            char hex[3] = {value[i + 1], value[i + 2], '\0'};
            char* end = nullptr;
            const long parsed = std::strtol(hex, &end, 16);
            if (end && *end == '\0') {
                decoded.push_back(static_cast<char>(parsed));
                i += 2;
                continue;
            }
        }
        decoded.push_back(value[i] == '+' ? ' ' : value[i]);
    }
    return decoded;
}

std::unordered_map<std::string, std::string> parseQuery(const std::string& query) {
    std::unordered_map<std::string, std::string> result;
    size_t start = 0;
    while (start <= query.size()) {
        const size_t end = query.find('&', start);
        const std::string part = query.substr(start, end == std::string::npos ? std::string::npos : end - start);
        const size_t equals = part.find('=');
        if (equals != std::string::npos)
            result[urlDecode(part.substr(0, equals))] = urlDecode(part.substr(equals + 1));
        if (end == std::string::npos) break;
        start = end + 1;
    }
    return result;
}

bool parseFlatJsonObject(const std::string& input,
                         std::unordered_map<std::string, std::string>& values) {
    try {
        const Json parsed = Json::parse(input);
        if (parsed.kind != Json::Object) return false;
        for (const auto& entry : parsed.object) values[entry.first] = entry.second.string();
        return true;
    } catch (...) { return false; }
}

std::string valueOf(const std::unordered_map<std::string, std::string>& values,
                    const std::string& key) {
    const auto it = values.find(key);
    return it == values.end() ? "" : trim(it->second);
}

} // namespace

HttpServer::HttpServer(int p, const std::string& directory)
    : port(p), listenSocket(INVALID_SOCKET), isRunning(false), dataDirectory(directory) {
    WSADATA wsaData;
    int result = WSAStartup(MAKEWORD(2, 2), &wsaData);
    if (result != 0) {
        std::cerr << "[HttpServer] WSAStartup failed: " << result << "\n";
    }
    initializeFixtures();
    if (!dataDirectory.empty()) {
        if (!CreateDirectoryA(dataDirectory.c_str(), nullptr) && GetLastError() != ERROR_ALREADY_EXISTS)
            throw std::runtime_error("Cannot create data directory");
        for (const std::string mode : {"org", "family"}) {
            const std::string file = dataDirectory + "/" + mode + ".json";
            if (GetFileAttributesA(file.c_str()) == INVALID_FILE_ATTRIBUTES) continue;
            try {
                std::ifstream input(file, std::ios::binary);
                if (!input) throw std::runtime_error("Cannot read stored hierarchy");
                std::ostringstream contents; contents << input.rdbuf();
                BinaryTree loaded;
                importTree(contents.str(), mode, loaded);
                treeForMode(mode)->swap(loaded);
            } catch (const std::exception& error) {
                // Never silently overwrite a damaged save with fixture data.
                readOnlyStorage = true;
                std::cerr << "[Storage] " << file << ": " << error.what() << "; writes disabled\n";
            }
        }
    }
}

bool HttpServer::saveTree(const std::string& mode, const BinaryTree& tree) {
    if (readOnlyStorage) return false;
    if (dataDirectory.empty()) return true; // Isolated in-memory contract tests.
    const std::string file = dataDirectory + "/" + mode + ".json";
    const std::string temporary = file + ".tmp";
    std::ofstream output(temporary, std::ios::binary | std::ios::trunc);
    output << hierarchyJson(mode, tree);
    output.flush();
    if (!output) return false;
    output.close();
    return MoveFileExA(temporary.c_str(), file.c_str(), MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH) != 0;
}

void HttpServer::importTree(const std::string& body, const std::string& mode, BinaryTree& tree) {
    const Json document = Json::parse(body);
    if (document.at("mode").string() != mode) throw std::runtime_error("File mode must match the selected hierarchy");
    const Json& nodes = document.at("nodes");
    const Json& root = document.at("rootId");
    if (nodes.kind != Json::Array || nodes.array.size() > 1000) throw std::runtime_error("nodes must be an array of at most 1000 members");
    if (nodes.array.empty()) {
        if (root.kind != Json::Null) throw std::runtime_error("Empty hierarchy must have null rootId");
        return;
    }
    const std::string rootId = root.string();
    std::set<std::string> ids;
    std::vector<const Json*> pending;
    for (const Json& node : nodes.array) {
        const std::string id = node.at("id").string();
        const std::string name = node.at("name").string();
        const std::string role = node.at("role").string();
        if (trim(id).empty() || trim(name).empty() || trim(role).empty() || id.size() > 200 || name.size() > 200 || role.size() > 200)
            throw std::runtime_error("Members require nonempty id, name, and role (maximum 200 bytes each)");
        if (!ids.insert(id).second) throw std::runtime_error("Duplicate member id");
        const auto dept = node.object.find("department");
        const std::string department = dept == node.object.end() ? "" : dept->second.string();
        if (department.size() > 200) throw std::runtime_error("Department exceeds 200 bytes");
        if (id == rootId) {
            if (node.at("parentId").kind != Json::Null) throw std::runtime_error("Root cannot have a parent");
            tree.setRoot(id, name, role, department);
        } else { node.at("parentId").string(); pending.push_back(&node); }
    }
    if (!tree.getRoot()) throw std::runtime_error("rootId does not identify a member");
    while (!pending.empty()) {
        bool progressed = false;
        std::set<std::string> availableParents;
        for (const TreeNode* member : tree.traversePreorder()) availableParents.insert(member->id);
        for (auto it = pending.begin(); it != pending.end();) {
            const Json& node = **it;
            const std::string parent = node.at("parentId").string();
            if (availableParents.count(parent)) {
                const auto dept = node.object.find("department");
                tree.addChild(parent, node.at("id").string(), node.at("name").string(), node.at("role").string(), dept == node.object.end() ? "" : dept->second.string());
                it = pending.erase(it); progressed = true;
            } else ++it;
        }
        if (!progressed) throw std::runtime_error("Hierarchy contains a cycle or missing parent");
    }
    // Optional binary links must agree with the parent relationships and array order.
    for (const Json& node : nodes.array) {
        TreeNode* actual = tree.find(node.at("id").string());
        for (const std::string key : {"leftChildId", "rightSiblingId"}) {
            auto it = node.object.find(key);
            if (it == node.object.end()) continue;
            TreeNode* linked = key == "leftChildId" ? actual->left : actual->right;
            if ((it->second.kind == Json::Null && linked) || (it->second.kind != Json::Null && (!linked || it->second.string() != linked->id)))
                throw std::runtime_error("Binary pointers do not match hierarchy order");
        }
    }
}

HttpServer::~HttpServer() {
    stop();
    WSACleanup();
}

void HttpServer::initializeFixtures() {
    orgTree.setRoot("org-ceo", "Sarah Connor", "Chief Executive Officer", "Executive");
    orgTree.addChild("org-ceo", "org-vp-tech", "John Connor", "VP Technology", "Engineering");
    orgTree.addChild("org-ceo", "org-vp-ops", "Kyle Reese", "VP Operations", "Operations");
    orgTree.addChild("org-vp-tech", "org-lead-arch", "Miles Dyson", "Lead Architect", "Systems Architecture");

    familyTree.setRoot("fam-patriarch", "Arthur Pendragon", "Family Patriarch", "Royal House");
    familyTree.addChild("fam-patriarch", "fam-first-child", "Galahad", "First Child (Eldest)", "Line of Avalon");
    familyTree.addChild("fam-patriarch", "fam-sibling", "Gawain", "Second Child (Sibling)", "Line of Orkney");
    familyTree.addChild("fam-first-child", "fam-grandchild", "Lancelot", "Grandchild (Branch)", "Champions");
}

BinaryTree* HttpServer::treeForMode(const std::string& mode) {
    if (mode == "org") return &orgTree;
    if (mode == "family") return &familyTree;
    return nullptr;
}

bool HttpServer::start() {
    listenSocket = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    if (listenSocket == INVALID_SOCKET) {
        std::cerr << "[HttpServer] Socket creation failed: " << WSAGetLastError() << "\n";
        return false;
    }

    // Allow quick reuse of address
    BOOL opt = TRUE;
    setsockopt(listenSocket, SOL_SOCKET, SO_REUSEADDR, (const char*)&opt, sizeof(opt));

    sockaddr_in serverAddr;
    serverAddr.sin_family = AF_INET;
    serverAddr.sin_addr.s_addr = htonl(INADDR_LOOPBACK); // 127.0.0.1
    serverAddr.sin_port = htons(static_cast<u_short>(port));

    if (bind(listenSocket, (sockaddr*)&serverAddr, sizeof(serverAddr)) == SOCKET_ERROR) {
        std::cerr << "[HttpServer] Bind failed on port " << port << ": " << WSAGetLastError() << "\n";
        closesocket(listenSocket);
        listenSocket = INVALID_SOCKET;
        return false;
    }

    if (listen(listenSocket, SOMAXCONN) == SOCKET_ERROR) {
        std::cerr << "[HttpServer] Listen failed: " << WSAGetLastError() << "\n";
        closesocket(listenSocket);
        listenSocket = INVALID_SOCKET;
        return false;
    }

    isRunning = true;
    std::cout << "[HttpServer] Listening on http://127.0.0.1:" << port << "\n";
    return true;
}

void HttpServer::stop() {
    isRunning = false;
    if (listenSocket != INVALID_SOCKET) {
        closesocket(listenSocket);
        listenSocket = INVALID_SOCKET;
    }
}

std::string HttpServer::buildResponse(int statusCode, const std::string& statusText,
                                      const std::string& contentType, const std::string& body,
                                      bool isOptions) {
    std::ostringstream response;
    response << "HTTP/1.1 " << statusCode << " " << statusText << "\r\n";
    response << "Access-Control-Allow-Origin: *\r\n";
    response << "Access-Control-Allow-Methods: GET, POST, PATCH, PUT, DELETE, OPTIONS\r\n";
    response << "Access-Control-Allow-Headers: Content-Type, Authorization\r\n";
    response << "Connection: close\r\n";

    if (isOptions) {
        response << "Content-Length: 0\r\n\r\n";
    } else {
        response << "Content-Type: " << contentType << "\r\n";
        response << "Content-Length: " << body.length() << "\r\n\r\n";
        response << body;
    }
    return response.str();
}

std::string HttpServer::errorResponse(int statusCode, const std::string& statusText,
                                      const std::string& error, const std::string& message,
                                      const std::string& path) {
    const std::string body = "{\"error\":\"" + jsonEscape(error) +
        "\",\"message\":\"" + jsonEscape(message) +
        "\",\"path\":\"" + jsonEscape(path) + "\"}";
    return buildResponse(statusCode, statusText, "application/json; charset=utf-8", body);
}

std::string HttpServer::hierarchyJson(const std::string& mode, const BinaryTree& tree) const {
    const TreeNode* rootNode = tree.getRoot();
    const std::vector<const TreeNode*> nodes = tree.traversePreorder();
    std::ostringstream json;
    json << "{\"mode\":\"" << jsonEscape(mode) << "\",\"rootId\":";
    if (rootNode) json << "\"" << jsonEscape(rootNode->id) << "\""; else json << "null";
    json << ",\"nodes\":[";
    for (size_t i = 0; i < nodes.size(); ++i) {
        const TreeNode* node = nodes[i];
        if (i) json << ',';
        json << "{\"id\":\"" << jsonEscape(node->id)
             << "\",\"name\":\"" << jsonEscape(node->name)
             << "\",\"role\":\"" << jsonEscape(node->role)
             << "\",\"department\":\"" << jsonEscape(node->department)
             << "\",\"parentId\":";
        if (node->parentId.empty()) json << "null"; else json << "\"" << jsonEscape(node->parentId) << "\"";
        json << ",\"leftChildId\":";
        if (node->left) json << "\"" << jsonEscape(node->left->id) << "\""; else json << "null";
        json << ",\"rightSiblingId\":";
        if (node->right) json << "\"" << jsonEscape(node->right->id) << "\""; else json << "null";
        json << '}';
    }
    json << "]}";
    return json.str();
}

std::string HttpServer::traversalJson(const std::string& mode, const std::string& type,
                                      const BinaryTree& tree) const {
    std::vector<const TreeNode*> nodes;
    if (type == "preorder") nodes = tree.traversePreorder();
    else if (type == "inorder") nodes = tree.traverseInorder();
    else nodes = tree.traversePostorder();
    std::ostringstream json;
    json << "{\"mode\":\"" << jsonEscape(mode) << "\",\"type\":\""
         << jsonEscape(type) << "\",\"order\":[";
    for (size_t i = 0; i < nodes.size(); ++i) {
        if (i) json << ',';
        json << "{\"step\":" << i + 1 << ",\"id\":\"" << jsonEscape(nodes[i]->id)
             << "\",\"name\":\"" << jsonEscape(nodes[i]->name)
             << "\",\"role\":\"" << jsonEscape(nodes[i]->role) << "\"}";
    }
    json << "],\"totalNodes\":" << nodes.size() << '}';
    return json.str();
}

std::string HttpServer::statsJson(const BinaryTree& tree) const {
    std::ostringstream json;
    json << "{\"totalMembers\":" << tree.getNodeCount()
         << ",\"binaryTreeHeight\":" << tree.getHeight() << ",\"rootId\":";
    if (tree.getRoot()) json << "\"" << jsonEscape(tree.getRoot()->id) << "\""; else json << "null";
    json << '}';
    return json.str();
}

std::string HttpServer::routeRequest(const std::string& method, const std::string& target,
                                     const std::string& body) {
    const size_t queryAt = target.find('?');
    const std::string path = target.substr(0, queryAt);
    const std::string query = queryAt == std::string::npos ? "" : target.substr(queryAt + 1);
    const std::unordered_map<std::string, std::string> params = parseQuery(query);

    if (method == "OPTIONS") return buildResponse(204, "No Content", "text/plain", "", true);
    if (method == "GET" && (path == "/api/status" || path == "/api/health")) {
        const std::string json = "{\"status\":\"ok\",\"service\":\"Hierarchy Explorer Backend\","
            "\"version\":\"2.0.0-m2\",\"compiler\":\"C++14\",\"networking\":\"WinSock2\"}";
        return buildResponse(200, "OK", "application/json; charset=utf-8", json);
    }

    const std::string nodePrefix = "/api/hierarchy/nodes/";
    const bool nodePath = path.compare(0, nodePrefix.size(), nodePrefix) == 0;
    const bool knownPath = path == "/api/hierarchy" || path == "/api/hierarchy/member" ||
        path == "/api/hierarchy/traverse" || path == "/api/hierarchy/stats" ||
        path == "/api/hierarchy/search" || path == "/api/hierarchy/export" || path == "/api/hierarchy/import" || nodePath;
    if (!knownPath) return errorResponse(404, "Not Found", "Not Found", "Endpoint does not exist", path);

    const auto modeIt = params.find("mode");
    if (path == "/api/hierarchy/search" || path == "/api/hierarchy/export" || path == "/api/hierarchy/import" || nodePath) {
        const std::string mode = modeIt == params.end() ? "" : modeIt->second;
        BinaryTree* tree = treeForMode(mode);
        if (!tree) return errorResponse(400, "Bad Request", "Invalid Request", "mode must be org or family", path);
        if (method == "GET" && path == "/api/hierarchy/export")
            return buildResponse(200, "OK", "application/json; charset=utf-8", hierarchyJson(mode, *tree));
        if (method == "GET" && path == "/api/hierarchy/search") {
            const auto queryIt = params.find("q");
            const std::string term = queryIt == params.end() ? "" : lowerCopy(trim(queryIt->second));
            std::ostringstream json; json << "{\"ids\":[";
            bool first = true;
            if (!term.empty()) for (const TreeNode* node : tree->traversePreorder()) {
                if (lowerCopy(node->id + " " + node->name + " " + node->role + " " + node->department).find(term) == std::string::npos) continue;
                if (!first) json << ',';
                first = false; json << '"' << jsonEscape(node->id) << '"';
            }
            json << "]}";
            return buildResponse(200, "OK", "application/json; charset=utf-8", json.str());
        }
        if ((method == "POST" && path == "/api/hierarchy/import") || (nodePath && (method == "PATCH" || method == "DELETE"))) {
            BinaryTree candidate;
            try {
                if (path == "/api/hierarchy/import") importTree(body, mode, candidate);
                else {
                    importTree(hierarchyJson(mode, *tree), mode, candidate);
                    const std::string id = urlDecode(path.substr(nodePrefix.size()));
                    TreeNode* node = candidate.find(id);
                    if (!node) return errorResponse(404, "Not Found", "Not Found", "Member does not exist", path);
                    if (method == "DELETE") candidate.removeMember(id);
                    else {
                        std::unordered_map<std::string, std::string> values;
                        if (!parseFlatJsonObject(body, values) || values.empty()) throw std::runtime_error("Provide name, role, or department as strings");
                        for (const auto& field : values) {
                            if (field.first != "name" && field.first != "role" && field.first != "department") throw std::runtime_error("Only name, role, and department can be edited");
                            if ((field.first != "department" && trim(field.second).empty()) || field.second.size() > 200) throw std::runtime_error("Name and role cannot be blank; fields are limited to 200 bytes");
                            if (field.first == "name") node->name = trim(field.second);
                            else if (field.first == "role") node->role = trim(field.second);
                            else node->department = trim(field.second);
                        }
                    }
                }
            } catch (const std::exception& error) { return errorResponse(400, "Bad Request", "Invalid Request", error.what(), path); }
            if (!saveTree(mode, candidate)) return errorResponse(500, "Internal Server Error", "Storage Error", "Could not save hierarchy; no changes were applied", path);
            tree->swap(candidate);
            return buildResponse(200, "OK", "application/json; charset=utf-8", hierarchyJson(mode, *tree));
        }
        return errorResponse(405, "Method Not Allowed", "Method Not Allowed", "Unsupported HTTP method", path);
    }
    if (method == "GET" && path == "/api/hierarchy") {
        const std::string mode = modeIt == params.end() ? "" : modeIt->second;
        BinaryTree* tree = treeForMode(mode);
        if (!tree) return errorResponse(400, "Bad Request", "Invalid Request", "mode must be org or family", path);
        return buildResponse(200, "OK", "application/json; charset=utf-8", hierarchyJson(mode, *tree));
    }
    if (method == "GET" && path == "/api/hierarchy/traverse") {
        const std::string mode = modeIt == params.end() ? "" : modeIt->second;
        const auto typeIt = params.find("type");
        const std::string type = typeIt == params.end() ? "" : typeIt->second;
        BinaryTree* tree = treeForMode(mode);
        if (!tree) return errorResponse(400, "Bad Request", "Invalid Request", "mode must be org or family", path);
        if (type != "preorder" && type != "inorder" && type != "postorder")
            return errorResponse(400, "Bad Request", "Invalid Request", "type must be preorder, inorder, or postorder", path);
        return buildResponse(200, "OK", "application/json; charset=utf-8", traversalJson(mode, type, *tree));
    }
    if (method == "GET" && path == "/api/hierarchy/stats") {
        const std::string mode = modeIt == params.end() ? "" : modeIt->second;
        BinaryTree* tree = treeForMode(mode);
        if (!tree) return errorResponse(400, "Bad Request", "Invalid Request", "mode must be org or family", path);
        return buildResponse(200, "OK", "application/json; charset=utf-8", statsJson(*tree));
    }
    if (method == "POST" && path == "/api/hierarchy/member") {
        std::unordered_map<std::string, std::string> values;
        if (!parseFlatJsonObject(body, values))
            return errorResponse(400, "Bad Request", "Invalid JSON", "Body must be a flat JSON object with string values", path);
        const std::string mode = valueOf(values, "mode");
        const std::string id = valueOf(values, "id");
        const std::string name = valueOf(values, "name");
        const std::string role = valueOf(values, "role");
        const std::string department = valueOf(values, "department");
        const std::string parentId = valueOf(values, "parentId");
        const std::string relation = valueOf(values, "relation");
        BinaryTree* tree = treeForMode(mode);
        if (!tree) return errorResponse(400, "Bad Request", "Invalid Request", "mode must be org or family", path);
        if (id.empty() || name.empty() || role.empty() || (!tree->isEmpty() && parentId.empty()) || relation.empty())
            return errorResponse(400, "Bad Request", "Invalid Request", "id, name, role, and relation are required; parentId is required unless the tree is empty", path);
        if (relation != "child")
            return errorResponse(400, "Bad Request", "Invalid Request", "relation must be child", path);
        if (id.size() > 200 || name.size() > 200 || role.size() > 200 || department.size() > 200 || tree->getNodeCount() >= 1000)
            return errorResponse(400, "Bad Request", "Invalid Request", "Fields are limited to 200 bytes and hierarchies to 1000 members", path);
        if (tree->find(id))
            return errorResponse(409, "Conflict", "Conflict", "A member with this id already exists", path);
        if (!tree->isEmpty() && !tree->find(parentId))
            return errorResponse(404, "Not Found", "Not Found", "Parent member does not exist", path);
        BinaryTree candidate;
        importTree(hierarchyJson(mode, *tree), mode, candidate);
        const bool inserted = candidate.isEmpty() ? candidate.setRoot(id, name, role, department) : candidate.addChild(parentId, id, name, role, department);
        if (!inserted)
            return errorResponse(409, "Conflict", "Conflict", "Member could not be inserted", path);
        if (!saveTree(mode, candidate)) return errorResponse(500, "Internal Server Error", "Storage Error", "Could not save hierarchy; no changes were applied", path);
        tree->swap(candidate);
        const TreeNode* created = tree->find(id);
        std::ostringstream json;
        json << "{\"member\":{\"id\":\"" << jsonEscape(created->id)
             << "\",\"name\":\"" << jsonEscape(created->name)
             << "\",\"role\":\"" << jsonEscape(created->role)
             << "\",\"department\":\"" << jsonEscape(created->department)
             << "\",\"parentId\":" << (created->parentId.empty() ? "null" : "\"" + jsonEscape(created->parentId) + "\"")
             << ",\"leftChildId\":null,\"rightSiblingId\":null},\"mode\":\""
             << jsonEscape(mode) << "\",\"totalMembers\":" << tree->getNodeCount() << '}';
        return buildResponse(201, "Created", "application/json; charset=utf-8", json.str());
    }
    return errorResponse(405, "Method Not Allowed", "Method Not Allowed",
                         "HTTP method is not supported for this endpoint", path);
}

void HttpServer::handleClient(SOCKET clientSocket) {
    std::string request;
    char buffer[4096];
    size_t expectedSize = std::string::npos;
    while (request.size() < 1024 * 1024) {
        const int received = recv(clientSocket, buffer, sizeof(buffer), 0);
        if (received <= 0) break;
        request.append(buffer, static_cast<size_t>(received));
        const size_t headerEnd = request.find("\r\n\r\n");
        if (headerEnd != std::string::npos && expectedSize == std::string::npos) {
            size_t contentLength = 0;
            std::istringstream headers(request.substr(0, headerEnd));
            std::string line;
            std::getline(headers, line);
            while (std::getline(headers, line)) {
                const size_t colon = line.find(':');
                if (colon != std::string::npos && lowerCopy(trim(line.substr(0, colon))) == "content-length")
                    contentLength = static_cast<size_t>(std::strtoul(trim(line.substr(colon + 1)).c_str(), nullptr, 10));
            }
            expectedSize = headerEnd + 4 + contentLength;
        }
        if (expectedSize != std::string::npos && request.size() >= expectedSize) break;
    }

    const size_t headerEnd = request.find("\r\n\r\n");
    std::string response;
    if (headerEnd == std::string::npos) {
        response = errorResponse(400, "Bad Request", "Invalid Request", "HTTP headers are incomplete", "");
    } else {
        std::istringstream line(request.substr(0, request.find("\r\n")));
        std::string method, target, version;
        line >> method >> target >> version;
        if (method.empty() || target.empty() || version.compare(0, 5, "HTTP/") != 0)
            response = errorResponse(400, "Bad Request", "Invalid Request", "Malformed HTTP request line", target);
        else {
            try {
                response = routeRequest(method, target, request.substr(headerEnd + 4));
            } catch (const std::exception& error) {
                std::cerr << "[HttpServer] Request failed: " << error.what() << "\n";
                response = errorResponse(500, "Internal Server Error", "Internal Server Error",
                                         "The server could not complete the request", target);
            } catch (...) {
                response = errorResponse(500, "Internal Server Error", "Internal Server Error",
                                         "The server could not complete the request", target);
            }
        }
    }

    size_t sent = 0;
    while (sent < response.size()) {
        const int count = send(clientSocket, response.c_str() + sent,
                               static_cast<int>(response.size() - sent), 0);
        if (count == SOCKET_ERROR || count == 0) break;
        sent += static_cast<size_t>(count);
    }
    closesocket(clientSocket);
}

void HttpServer::run(int maxRequests) {
    int servedCount = 0;

    while (isRunning) {
        // Use select with timeout to allow clean shutdown without hanging
        fd_set readFds;
        FD_ZERO(&readFds);
        FD_SET(listenSocket, &readFds);

        timeval tv;
        tv.tv_sec = 0;
        tv.tv_usec = 300000; // 300ms timeout check

        int activity = select(0, &readFds, nullptr, nullptr, &tv);

        if (activity == SOCKET_ERROR) {
            if (isRunning) {
                std::cerr << "[HttpServer] Select error: " << WSAGetLastError() << "\n";
            }
            break;
        }

        if (activity > 0 && FD_ISSET(listenSocket, &readFds)) {
            sockaddr_in clientAddr;
            int addrLen = sizeof(clientAddr);
            SOCKET clientSocket = accept(listenSocket, (sockaddr*)&clientAddr, &addrLen);

            if (clientSocket != INVALID_SOCKET) {
                handleClient(clientSocket);
                servedCount++;

                if (maxRequests > 0 && servedCount >= maxRequests) {
                    std::cout << "[HttpServer] Reached max requests limit (" << maxRequests << "). Exiting run loop.\n";
                    break;
                }
            }
        }
    }
}
