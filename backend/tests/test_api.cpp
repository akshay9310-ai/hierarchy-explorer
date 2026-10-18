#include "../include/HttpServer.hpp"
#include <cassert>
#include <iostream>
#include <string>

namespace {

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

} // namespace

int main() {
    std::cout << "=== Running HTTP API Contract Tests ===\n";
    testReadEndpoints();
    testInsertionAndIsolation();
    testErrors();
    testUpdateEndpoint();
    testDeleteEndpoint();
    std::cout << "=== All API Tests Passed Successfully! ===\n";
    return 0;
}
