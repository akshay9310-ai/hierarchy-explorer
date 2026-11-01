#include "../include/HttpServer.hpp"
#include <cassert>
#include <iostream>
#include <string>
#include "FileStorage.hpp"
#include <cstdlib>
#include <fstream>

namespace {

bool removeTestDirectory(const std::string& path) {
#ifdef _WIN32
    return RemoveDirectoryA(path.c_str()) != 0;
#else
    return rmdir(path.c_str()) == 0;
#endif
}

void expectContains(const std::string& response, const std::string& expected) {
    assert(response.find(expected) != std::string::npos);
}

void testReadEndpoints() {
    HttpServer server(0);

    const std::string status = server.routeRequest("GET", "/api/status");
    expectContains(status, "HTTP/1.1 200 OK");
    expectContains(status, "\"version\":\"2.0.0-m2\"");

    const std::string hierarchy = server.routeRequest("GET", "/api/hierarchy?mode=org");
    expectContains(hierarchy, "HTTP/1.1 200 OK");
    expectContains(hierarchy, "\"rootId\":\"org-ceo\"");
    expectContains(hierarchy, "\"rightSiblingId\":\"org-vp-ops\"");

    const std::string traversal = server.routeRequest(
        "GET", "/api/hierarchy/traverse?mode=org&type=preorder");
    expectContains(traversal, "HTTP/1.1 200 OK");
    expectContains(traversal, "\"totalNodes\":4");
    assert(traversal.find("org-ceo") < traversal.find("org-vp-tech"));
    assert(traversal.find("org-vp-tech") < traversal.find("org-lead-arch"));

    const std::string stats = server.routeRequest("GET", "/api/hierarchy/stats?mode=family");
    expectContains(stats, "\"totalMembers\":4");
    expectContains(stats, "\"rootId\":\"fam-patriarch\"");

    const std::string options = server.routeRequest("OPTIONS", "/api/hierarchy");
    expectContains(options, "HTTP/1.1 204 No Content");
    std::cout << "[PASS] Read, traversal, stats, status, and CORS endpoints verified\n";
}

void testInsertionAndIsolation() {
    HttpServer server(0);
    const std::string body = "{\"mode\":\"org\",\"id\":\"org-intern\","
        "\"name\":\"Ava Stone\",\"role\":\"Intern\",\"department\":\"Engineering\","
        "\"parentId\":\"org-vp-tech\",\"relation\":\"child\"}";
    const std::string created = server.routeRequest("POST", "/api/hierarchy/member", body);
    expectContains(created, "HTTP/1.1 201 Created");
    expectContains(created, "\"id\":\"org-intern\"");
    expectContains(server.routeRequest("GET", "/api/hierarchy?mode=org"), "org-intern");
    assert(server.routeRequest("GET", "/api/hierarchy?mode=family").find("org-intern") == std::string::npos);

    const std::string duplicate = server.routeRequest("POST", "/api/hierarchy/member", body);
    expectContains(duplicate, "HTTP/1.1 409 Conflict");
    std::cout << "[PASS] Insertion, duplicate protection, and mode isolation verified\n";
}

void testErrors() {
    HttpServer server(0);
    expectContains(server.routeRequest("GET", "/api/hierarchy"), "HTTP/1.1 400 Bad Request");
    expectContains(server.routeRequest("GET", "/api/hierarchy?mode=invalid"), "HTTP/1.1 400 Bad Request");
    expectContains(server.routeRequest("GET", "/api/hierarchy/traverse?mode=org&type=levelorder"),
                   "HTTP/1.1 400 Bad Request");
    expectContains(server.routeRequest("POST", "/api/hierarchy/member", "not-json"),
                   "HTTP/1.1 400 Bad Request");
    expectContains(server.routeRequest("POST", "/api/hierarchy/member",
        "{\"mode\":\"org\",\"id\":\"x\",\"name\":\"X\",\"role\":\"R\","
        "\"parentId\":\"missing\",\"relation\":\"child\"}"), "HTTP/1.1 404 Not Found");
    expectContains(server.routeRequest("DELETE", "/api/hierarchy?mode=org"),
                   "HTTP/1.1 405 Method Not Allowed");
    expectContains(server.routeRequest("GET", "/api/unknown"), "HTTP/1.1 404 Not Found");
    std::cout << "[PASS] API validation and error responses verified\n";
}

std::string bodyOf(const std::string& response) {
    return response.substr(response.find("\r\n\r\n") + 4);
}

void testManagementAndImport() {
    HttpServer server(0);
    const std::string original = bodyOf(server.routeRequest("GET", "/api/hierarchy/export?mode=org"));
    expectContains(server.routeRequest("PATCH", "/api/hierarchy/nodes/org-vp-tech?mode=org", "{\"name\":\"Jane \\u2603\",\"department\":\"\"}"), "200 OK");
    expectContains(server.routeRequest("GET", "/api/hierarchy/search?mode=org&q=jAnE"), "org-vp-tech");
    expectContains(server.routeRequest("GET", "/api/hierarchy/search?mode=org&q=NO_MATCH"), "\"ids\":[]");
    expectContains(server.routeRequest("PATCH", "/api/hierarchy/nodes/org-ceo?mode=org", "{\"name\":\" \"}"), "400 Bad Request");
    expectContains(server.routeRequest("PATCH", "/api/hierarchy/nodes/org-ceo?mode=org", "{\"parentId\":\"org-vp-tech\"}"), "400 Bad Request");
    expectContains(server.routeRequest("DELETE", "/api/hierarchy/nodes/missing?mode=org"), "404 Not Found");
    expectContains(server.routeRequest("DELETE", "/api/hierarchy/nodes/org-vp-tech?mode=org"), "200 OK");
    const std::string remaining = server.routeRequest("GET", "/api/hierarchy?mode=org");
    assert(remaining.find("org-lead-arch") == std::string::npos);
    assert(remaining.find("org-vp-tech") == std::string::npos);
    expectContains(remaining, "\"leftChildId\":\"org-vp-ops\"");
    expectContains(server.routeRequest("GET", "/api/hierarchy/stats?mode=org"), "\"totalMembers\":2");
    expectContains(server.routeRequest("POST", "/api/hierarchy/import?mode=org", original), "200 OK");
    assert(bodyOf(server.routeRequest("GET", "/api/hierarchy?mode=org")) == original);
    for (const std::string type : {"preorder", "inorder", "postorder"})
        expectContains(server.routeRequest("GET", "/api/hierarchy/traverse?mode=org&type=" + type), "\"totalNodes\":4");
    const std::string bad = "{\"mode\":\"org\",\"rootId\":\"r\",\"nodes\":[{\"id\":\"r\",\"name\":\"R\",\"role\":\"Root\",\"parentId\":null},{\"id\":\"x\",\"name\":\"X\",\"role\":\"Child\",\"parentId\":\"x\"}]}";
    expectContains(server.routeRequest("POST", "/api/hierarchy/import?mode=org", bad), "400 Bad Request");
    expectContains(server.routeRequest("POST", "/api/hierarchy/import?mode=family", original), "400 Bad Request");
    expectContains(server.routeRequest("POST", "/api/hierarchy/import?mode=org", "{\"mode\":\"org\",\"mode\":\"org\"}"), "400 Bad Request");
    assert(bodyOf(server.routeRequest("GET", "/api/hierarchy?mode=org")) == original);
    expectContains(server.routeRequest("DELETE", "/api/hierarchy/nodes/org-vp-ops?mode=org"), "200 OK");
    expectContains(server.routeRequest("GET", "/api/hierarchy?mode=org"), "org-lead-arch");
    expectContains(server.routeRequest("DELETE", "/api/hierarchy/nodes/org-ceo?mode=org"), "\"nodes\":[]");
    expectContains(server.routeRequest("POST", "/api/hierarchy/member", "{\"mode\":\"org\",\"id\":\"new-root\",\"name\":\"Root\",\"role\":\"Leader\",\"parentId\":\"\",\"relation\":\"child\"}"), "201 Created");
    expectContains(server.routeRequest("GET", "/api/hierarchy?mode=org"), "\"rootId\":\"new-root\"");
    expectContains(server.routeRequest("GET", "/api/hierarchy/stats?mode=family"), "\"totalMembers\":4");
    const std::string shuffled = "{\"mode\":\"org\",\"rootId\":\"r\",\"nodes\":[{\"id\":\"a\",\"name\":\"A\",\"role\":\"Child\",\"parentId\":\"p\"},{\"id\":\"p\",\"name\":\"P\",\"role\":\"Parent\",\"parentId\":\"r\"},{\"id\":\"b\",\"name\":\"B\",\"role\":\"Child\",\"parentId\":\"p\"},{\"id\":\"r\",\"name\":\"R\",\"role\":\"Root\",\"parentId\":null}]}";
    expectContains(server.routeRequest("POST", "/api/hierarchy/import?mode=org", shuffled), "200 OK");
    const std::string sorted = server.routeRequest("GET", "/api/hierarchy?mode=org");
    expectContains(sorted, "\"leftChildId\":\"a\"");
    expectContains(sorted, "\"rightSiblingId\":\"b\"");
    std::cout << "[PASS] Edit, search, branch deletion, root recreation, and atomic import verified\n";
}

void testPersistence() {
#ifdef _WIN32
    char temporary[MAX_PATH];
    assert(GetTempPathA(MAX_PATH, temporary));
    const std::string directory = std::string(temporary) + "hierarchy-test-" + std::to_string(GetCurrentProcessId()) + "-" + std::to_string(GetTickCount());
#else
    char temporary[] = "/tmp/hierarchy-test-XXXXXX";
    char* created = mkdtemp(temporary);
    assert(created);
    const std::string directory(created);
#endif
    {
        HttpServer server(0, directory);
        expectContains(server.routeRequest("PATCH", "/api/hierarchy/nodes/org-ceo?mode=org", "{\"name\":\"Saved Leader\"}"), "200 OK");
        expectContains(server.routeRequest("DELETE", "/api/hierarchy/nodes/fam-patriarch?mode=family"), "200 OK");
        expectContains(server.routeRequest("PUT", "/api/hierarchy/member", "{\"mode\":\"org\",\"id\":\"org-vp-ops\",\"name\":\"Saved Operations\",\"role\":\"VP Operations\"}"), "200 OK");
        expectContains(server.routeRequest("DELETE", "/api/hierarchy/member?mode=org&id=org-lead-arch"), "200 OK");
        expectContains(server.routeRequest("POST", "/api/hierarchy/member", "{\"mode\":\"org\",\"id\":\"persisted-child\",\"name\":\"Saved Child\",\"role\":\"Tester\",\"parentId\":\"org-vp-tech\",\"relation\":\"child\"}"), "201 Created");
    }
    {
        HttpServer restarted(0, directory);
        expectContains(restarted.routeRequest("GET", "/api/hierarchy?mode=org"), "Saved Leader");
        expectContains(restarted.routeRequest("GET", "/api/hierarchy?mode=family"), "\"nodes\":[]");
        const std::string restored = restarted.routeRequest("GET", "/api/hierarchy?mode=org");
        expectContains(restored, "Saved Operations");
        expectContains(restored, "persisted-child");
        assert(restored.find("org-lead-arch") == std::string::npos);
        // Prevent atomic replacement to simulate a failed disk commit.
        assert(std::remove((directory + "/org.json").c_str()) == 0);
        assert(FileStorage::createDirectory(directory + "/org.json"));
        expectContains(restarted.routeRequest("PATCH", "/api/hierarchy/nodes/org-ceo?mode=org", "{\"name\":\"Unsaved\"}"), "500 Internal Server Error");
        expectContains(restarted.routeRequest("GET", "/api/hierarchy?mode=org"), "Saved Leader");
        expectContains(restarted.routeRequest("PUT", "/api/hierarchy/member", "{\"mode\":\"org\",\"id\":\"org-ceo\",\"name\":\"Unsaved\",\"role\":\"CEO\"}"), "500 Internal Server Error");
        expectContains(restarted.routeRequest("DELETE", "/api/hierarchy/member?mode=org&id=org-vp-ops"), "500 Internal Server Error");
        assert(bodyOf(restarted.routeRequest("GET", "/api/hierarchy?mode=org")) == bodyOf(restored));
        assert(removeTestDirectory(directory + "/org.json"));
        std::remove((directory + "/org.json.tmp").c_str());
    }
    {
        std::ofstream corrupt(directory + "/org.json"); corrupt << "invalid json";
    }
    {
        HttpServer protectedServer(0, directory);
        expectContains(protectedServer.routeRequest("PATCH", "/api/hierarchy/nodes/org-ceo?mode=org", "{\"name\":\"Overwrite\"}"), "500 Internal Server Error");
    }
    assert(std::remove((directory + "/org.json").c_str()) == 0);
    assert(std::remove((directory + "/family.json").c_str()) == 0);
    assert(removeTestDirectory(directory));
    std::cout << "[PASS] Restart persistence, empty saves, write rollback, and damaged-file protection verified\n";
}

void testUpdateEndpoint() {
    HttpServer server(0);

    // 1. Valid update in org mode
    const std::string orgUpdate = "{\"mode\":\"org\",\"id\":\"org-lead-arch\","
        "\"name\":\"Dr. Miles Dyson\",\"role\":\"Chief Architect\",\"department\":\"Platforms\"}";
    const std::string orgRes = server.routeRequest("PUT", "/api/hierarchy/member", orgUpdate);
    expectContains(orgRes, "HTTP/1.1 200 OK");
    expectContains(orgRes, "\"name\":\"Dr. Miles Dyson\"");
    expectContains(orgRes, "\"role\":\"Chief Architect\"");
    expectContains(orgRes, "\"department\":\"Platforms\"");
    expectContains(orgRes, "\"totalMembers\":4");

    // Verify persistence in GET /api/hierarchy?mode=org
    const std::string getOrg = server.routeRequest("GET", "/api/hierarchy?mode=org");
    expectContains(getOrg, "Dr. Miles Dyson");
    expectContains(getOrg, "Chief Architect");

    // 2. Valid update in family mode
    const std::string famUpdate = "{\"mode\":\"family\",\"id\":\"fam-grandchild\","
        "\"name\":\"Sir Lancelot du Lac\",\"role\":\"First Knight\",\"department\":\"Champions\"}";
    const std::string famRes = server.routeRequest("PUT", "/api/hierarchy/member", famUpdate);
    expectContains(famRes, "HTTP/1.1 200 OK");
    expectContains(famRes, "\"name\":\"Sir Lancelot du Lac\"");

    // 3. Validation errors: missing required fields
    const std::string missingField = "{\"mode\":\"org\",\"id\":\"org-ceo\",\"name\":\"\",\"role\":\"\"}";
    expectContains(server.routeRequest("PUT", "/api/hierarchy/member", missingField), "HTTP/1.1 400 Bad Request");

    // 4. Validation errors: invalid mode
    const std::string invalidMode = "{\"mode\":\"invalid\",\"id\":\"org-ceo\",\"name\":\"Sarah\",\"role\":\"CEO\"}";
    expectContains(server.routeRequest("PUT", "/api/hierarchy/member", invalidMode), "HTTP/1.1 400 Bad Request");

    // 5. Member not found
    const std::string notFound = "{\"mode\":\"org\",\"id\":\"ghost\",\"name\":\"Ghost\",\"role\":\"None\"}";
    expectContains(server.routeRequest("PUT", "/api/hierarchy/member", notFound), "HTTP/1.1 404 Not Found");

    // 6. Exceeding max length
    const std::string tooLong(120, 'x');
    const std::string lengthExceeded = "{\"mode\":\"org\",\"id\":\"org-ceo\",\"name\":\"" + tooLong + "\",\"role\":\"CEO\"}";
    expectContains(server.routeRequest("PUT", "/api/hierarchy/member", lengthExceeded), "HTTP/1.1 400 Bad Request");

    std::cout << "[PASS] PUT /api/hierarchy/member contract, validation, and mode updates verified\n";
}

void testDeleteEndpoint() {
    HttpServer server(0);

    // 1. Delete leaf node via query parameters
    const std::string delLeaf = server.routeRequest("DELETE", "/api/hierarchy/member?mode=org&id=org-lead-arch");
    expectContains(delLeaf, "HTTP/1.1 200 OK");
    expectContains(delLeaf, "\"deletedMemberId\":\"org-lead-arch\"");
    expectContains(delLeaf, "\"deletedCount\":1");
    expectContains(delLeaf, "\"totalMembers\":3");
    // Verify removal in GET
    assert(server.routeRequest("GET", "/api/hierarchy?mode=org").find("org-lead-arch") == std::string::npos);

    // 2. Delete node with children via JSON body (family mode: fam-first-child has child fam-grandchild)
    const std::string delBranchBody = "{\"mode\":\"family\",\"id\":\"fam-first-child\"}";
    const std::string delBranch = server.routeRequest("DELETE", "/api/hierarchy/member", delBranchBody);
    expectContains(delBranch, "HTTP/1.1 200 OK");
    expectContains(delBranch, "\"deletedMemberId\":\"fam-first-child\"");
    expectContains(delBranch, "\"deletedCount\":2");
    expectContains(delBranch, "\"totalMembers\":2");

    // Verify that both fam-first-child and fam-grandchild are removed, but fam-patriarch and fam-sibling remain
    const std::string getFam = server.routeRequest("GET", "/api/hierarchy?mode=family");
    assert(getFam.find("fam-first-child") == std::string::npos);
    assert(getFam.find("fam-grandchild") == std::string::npos);
    expectContains(getFam, "fam-patriarch");
    expectContains(getFam, "fam-sibling");

    // 3. Reject root deletion
    const std::string delRoot = server.routeRequest("DELETE", "/api/hierarchy/member?mode=org&id=org-ceo");
    expectContains(delRoot, "HTTP/1.1 400 Bad Request");
    expectContains(delRoot, "Root member cannot be deleted");
    expectContains(server.routeRequest("GET", "/api/hierarchy?mode=org"), "org-ceo");

    // 4. Delete non-existent member -> 404
    const std::string delMissing = server.routeRequest("DELETE", "/api/hierarchy/member?mode=org&id=ghost");
    expectContains(delMissing, "HTTP/1.1 404 Not Found");

    // 5. Delete with invalid mode -> 400
    const std::string delBadMode = server.routeRequest("DELETE", "/api/hierarchy/member?mode=wrong&id=org-ceo");
    expectContains(delBadMode, "HTTP/1.1 400 Bad Request");

    std::cout << "[PASS] DELETE /api/hierarchy/member leaf, branch, root rejection, and query/body handling verified\n";
}

void testCorsAndCloudHeaders() {
    HttpServer server(0);

    // 1. Localhost origin reflects
    const std::string localOpt = server.routeRequest("OPTIONS", "/api/hierarchy", "", "http://localhost:5173");
    expectContains(localOpt, "HTTP/1.1 204 No Content");
    expectContains(localOpt, "Access-Control-Allow-Origin: http://localhost:5173");
    expectContains(localOpt, "Access-Control-Allow-Methods: GET, POST, PATCH, PUT, DELETE, OPTIONS");

    // 2. Vercel deployment origin reflects
    const std::string vercelOpt = server.routeRequest("OPTIONS", "/api/hierarchy/member", "", "https://hierarchy-explorer.vercel.app");
    expectContains(vercelOpt, "HTTP/1.1 204 No Content");
    expectContains(vercelOpt, "Access-Control-Allow-Origin: https://hierarchy-explorer.vercel.app");
    const std::string cloud = "https://hierarchy-explorer.vercel.app";
    for (const std::string target : {"/api/hierarchy/search?mode=org&q=sarah", "/api/hierarchy/export?mode=org"})
        expectContains(server.routeRequest("GET", target, "", cloud), "Access-Control-Allow-Origin: " + cloud);
    expectContains(server.routeRequest("PATCH", "/api/hierarchy/nodes/org-ceo?mode=org", "{\"name\":\"Cloud Leader\"}", cloud), "Access-Control-Allow-Origin: " + cloud);
    expectContains(server.routeRequest("POST", "/api/hierarchy/import?mode=org", "invalid", cloud), "Access-Control-Allow-Origin: " + cloud);

    // 3. Status endpoint reflects cloud networking
    const std::string status = server.routeRequest("GET", "/api/status", "", "http://localhost:5173");
    expectContains(status, "HTTP/1.1 200 OK");
    expectContains(status, "\"status\":\"ok\"");

    std::cout << "[PASS] CORS origin resolution and cloud headers verified\n";
}

} // namespace

int main() {
    std::cout << "=== Running HTTP API Contract Tests ===\n";
    testReadEndpoints();
    testInsertionAndIsolation();
    testErrors();
    testManagementAndImport();
    testPersistence();
    testUpdateEndpoint();
    testDeleteEndpoint();
    testCorsAndCloudHeaders();
    std::cout << "=== All API Tests Passed Successfully! ===\n";
    return 0;
}
