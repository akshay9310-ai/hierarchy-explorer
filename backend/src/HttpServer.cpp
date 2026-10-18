#include "HttpServer.hpp"
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

void skipWhitespace(const std::string& input, size_t& pos) {
    while (pos < input.size() && std::isspace(static_cast<unsigned char>(input[pos]))) ++pos;
}

bool parseJsonString(const std::string& input, size_t& pos, std::string& value) {
    if (pos >= input.size() || input[pos++] != '"') return false;
    value.clear();
    while (pos < input.size()) {
        const char ch = input[pos++];
        if (ch == '"') return true;
        if (ch == '\\') {
            if (pos >= input.size()) return false;
            switch (input[pos++]) {
                case '"': value.push_back('"'); break;
                case '\\': value.push_back('\\'); break;
                case '/': value.push_back('/'); break;
                case 'b': value.push_back('\b'); break;
                case 'f': value.push_back('\f'); break;
                case 'n': value.push_back('\n'); break;
                case 'r': value.push_back('\r'); break;
                case 't': value.push_back('\t'); break;
                default: return false;
            }
        } else if (static_cast<unsigned char>(ch) < 0x20) return false;
        else value.push_back(ch);
    }
    return false;
}

bool parseFlatJsonObject(const std::string& input,
                         std::unordered_map<std::string, std::string>& values) {
    size_t pos = 0;
    skipWhitespace(input, pos);
    if (pos >= input.size() || input[pos++] != '{') return false;
    skipWhitespace(input, pos);
    if (pos < input.size() && input[pos] == '}') {
        ++pos; skipWhitespace(input, pos); return pos == input.size();
    }
    while (pos < input.size()) {
        std::string key, value;
        if (!parseJsonString(input, pos, key)) return false;
        skipWhitespace(input, pos);
        if (pos >= input.size() || input[pos++] != ':') return false;
        skipWhitespace(input, pos);
        if (!parseJsonString(input, pos, value)) return false;
        values[key] = value;
        skipWhitespace(input, pos);
        if (pos >= input.size()) return false;
        if (input[pos] == '}') {
            ++pos; skipWhitespace(input, pos); return pos == input.size();
        }
        if (input[pos++] != ',') return false;
        skipWhitespace(input, pos);
    }
    return false;
}

std::string valueOf(const std::unordered_map<std::string, std::string>& values,
                    const std::string& key) {
    const auto it = values.find(key);
    return it == values.end() ? "" : trim(it->second);
}

} // namespace

HttpServer::HttpServer(int p)
    : port(p), listenSocket(INVALID_SOCKET), isRunning(false) {
    WSADATA wsaData;
    int result = WSAStartup(MAKEWORD(2, 2), &wsaData);
    if (result != 0) {
        std::cerr << "[HttpServer] WSAStartup failed: " << result << "\n";
    }
    initializeFixtures();
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
    response << "Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS\r\n";
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

    const bool knownPath = path == "/api/hierarchy" || path == "/api/hierarchy/member" ||
        path == "/api/hierarchy/traverse" || path == "/api/hierarchy/stats";
    if (!knownPath) return errorResponse(404, "Not Found", "Not Found", "Endpoint does not exist", path);

    const auto modeIt = params.find("mode");
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
        if (id.empty() || name.empty() || role.empty() || parentId.empty() || relation.empty())
            return errorResponse(400, "Bad Request", "Invalid Request", "id, name, role, parentId, and relation are required", path);
        if (relation != "child")
            return errorResponse(400, "Bad Request", "Invalid Request", "relation must be child", path);
        if (tree->find(id))
            return errorResponse(409, "Conflict", "Conflict", "A member with this id already exists", path);
        if (!tree->find(parentId))
            return errorResponse(404, "Not Found", "Not Found", "Parent member does not exist", path);
        if (!tree->addChild(parentId, id, name, role, department))
            return errorResponse(409, "Conflict", "Conflict", "Member could not be inserted", path);
        const TreeNode* created = tree->find(id);
        std::ostringstream json;
        json << "{\"member\":{\"id\":\"" << jsonEscape(created->id)
             << "\",\"name\":\"" << jsonEscape(created->name)
             << "\",\"role\":\"" << jsonEscape(created->role)
             << "\",\"department\":\"" << jsonEscape(created->department)
             << "\",\"parentId\":\"" << jsonEscape(created->parentId)
             << "\",\"leftChildId\":null,\"rightSiblingId\":null},\"mode\":\""
             << jsonEscape(mode) << "\",\"totalMembers\":" << tree->getNodeCount() << '}';
        return buildResponse(201, "Created", "application/json; charset=utf-8", json.str());
    }
    if (method == "PUT" && path == "/api/hierarchy/member") {
        std::unordered_map<std::string, std::string> values;
        if (!parseFlatJsonObject(body, values))
            return errorResponse(400, "Bad Request", "Invalid JSON", "Body must be a flat JSON object with string values", path);
        const std::string mode = valueOf(values, "mode");
        const std::string id = valueOf(values, "id");
        const std::string name = valueOf(values, "name");
        const std::string role = valueOf(values, "role");
        const std::string department = valueOf(values, "department");
        BinaryTree* tree = treeForMode(mode);
        if (!tree) return errorResponse(400, "Bad Request", "Invalid Request", "mode must be org or family", path);
        if (id.empty() || name.empty() || role.empty())
            return errorResponse(400, "Bad Request", "Invalid Request", "id, name, and role are required", path);
        if (id.size() > 64 || name.size() > 100 || role.size() > 100 || department.size() > 100)
            return errorResponse(400, "Bad Request", "Invalid Request", "Input length exceeds allowed maximum", path);
        const auto res = tree->updateMember(id, name, role, department);
        if (res == BinaryTree::UpdateResult::NOT_FOUND)
            return errorResponse(404, "Not Found", "Not Found", "Member does not exist", path);
        if (res == BinaryTree::UpdateResult::INVALID_INPUT)
            return errorResponse(400, "Bad Request", "Invalid Request", "name and role cannot be empty", path);

        const TreeNode* updated = tree->find(id);
        std::ostringstream json;
        json << "{\"member\":{\"id\":\"" << jsonEscape(updated->id)
             << "\",\"name\":\"" << jsonEscape(updated->name)
             << "\",\"role\":\"" << jsonEscape(updated->role)
             << "\",\"department\":\"" << jsonEscape(updated->department)
             << "\",\"parentId\":";
        if (updated->parentId.empty()) json << "null"; else json << "\"" << jsonEscape(updated->parentId) << "\"";
        json << ",\"leftChildId\":";
        if (updated->left) json << "\"" << jsonEscape(updated->left->id) << "\""; else json << "null";
        json << ",\"rightSiblingId\":";
        if (updated->right) json << "\"" << jsonEscape(updated->right->id) << "\""; else json << "null";
        json << "},\"mode\":\"" << jsonEscape(mode) << "\",\"totalMembers\":" << tree->getNodeCount() << '}';
        return buildResponse(200, "OK", "application/json; charset=utf-8", json.str());
    }
    if (method == "DELETE" && path == "/api/hierarchy/member") {
        std::string mode, id;
        const auto modeIt = params.find("mode");
        const auto idIt = params.find("id");
        if (modeIt != params.end()) mode = modeIt->second;
        if (idIt != params.end()) id = idIt->second;

        if ((mode.empty() || id.empty()) && !body.empty()) {
            std::unordered_map<std::string, std::string> values;
            if (parseFlatJsonObject(body, values)) {
                if (mode.empty()) mode = valueOf(values, "mode");
                if (id.empty()) id = valueOf(values, "id");
            }
        }

        BinaryTree* tree = treeForMode(mode);
        if (!tree) return errorResponse(400, "Bad Request", "Invalid Request", "mode must be org or family", path);
        if (id.empty())
            return errorResponse(400, "Bad Request", "Invalid Request", "id is required", path);

        std::vector<std::string> deletedIds;
        const auto res = tree->deleteMember(id, deletedIds);
        if (res == BinaryTree::DeleteResult::NOT_FOUND)
            return errorResponse(404, "Not Found", "Not Found", "Member does not exist", path);
        if (res == BinaryTree::DeleteResult::ROOT_NODE)
            return errorResponse(400, "Bad Request", "Invalid Request", "Root member cannot be deleted", path);
        if (res == BinaryTree::DeleteResult::FAILED)
            return errorResponse(500, "Internal Server Error", "Internal Server Error", "Failed to delete member", path);

        std::ostringstream json;
        json << "{\"deletedMemberId\":\"" << jsonEscape(id)
             << "\",\"deletedCount\":" << deletedIds.size()
             << ",\"deletedNodeIds\":[";
        for (size_t i = 0; i < deletedIds.size(); ++i) {
            if (i) json << ',';
            json << "\"" << jsonEscape(deletedIds[i]) << "\"";
        }
        json << "],\"mode\":\"" << jsonEscape(mode) << "\",\"totalMembers\":" << tree->getNodeCount() << '}';
        return buildResponse(200, "OK", "application/json; charset=utf-8", json.str());
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
