#include "../include/HttpServer.hpp"
#include <cassert>
#include <iostream>
#include <string>
#include <windows.h>
#include <fstream>

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
    char temporary[MAX_PATH];
    assert(GetTempPathA(MAX_PATH, temporary));
    const std::string directory = std::string(temporary) + "hierarchy-test-" + std::to_string(GetCurrentProcessId()) + "-" + std::to_string(GetTickCount());
    {
        HttpServer server(0, directory);
        expectContains(server.routeRequest("PATCH", "/api/hierarchy/nodes/org-ceo?mode=org", "{\"name\":\"Saved Leader\"}"), "200 OK");
        expectContains(server.routeRequest("DELETE", "/api/hierarchy/nodes/fam-patriarch?mode=family"), "200 OK");
    }
    {
        HttpServer restarted(0, directory);
        expectContains(restarted.routeRequest("GET", "/api/hierarchy?mode=org"), "Saved Leader");
        expectContains(restarted.routeRequest("GET", "/api/hierarchy?mode=family"), "\"nodes\":[]");
        // Prevent atomic replacement to simulate a failed disk commit.
        assert(DeleteFileA((directory + "/org.json").c_str()));
        assert(CreateDirectoryA((directory + "/org.json").c_str(), nullptr));
        expectContains(restarted.routeRequest("PATCH", "/api/hierarchy/nodes/org-ceo?mode=org", "{\"name\":\"Unsaved\"}"), "500 Internal Server Error");
        expectContains(restarted.routeRequest("GET", "/api/hierarchy?mode=org"), "Saved Leader");
        assert(RemoveDirectoryA((directory + "/org.json").c_str()));
        DeleteFileA((directory + "/org.json.tmp").c_str());
    }
    {
        std::ofstream corrupt(directory + "/org.json"); corrupt << "invalid json";
    }
    {
        HttpServer protectedServer(0, directory);
        expectContains(protectedServer.routeRequest("PATCH", "/api/hierarchy/nodes/org-ceo?mode=org", "{\"name\":\"Overwrite\"}"), "500 Internal Server Error");
    }
    assert(DeleteFileA((directory + "/org.json").c_str()));
    assert(DeleteFileA((directory + "/family.json").c_str()));
    assert(RemoveDirectoryA(directory.c_str()));
    std::cout << "[PASS] Restart persistence, empty saves, write rollback, and damaged-file protection verified\n";
}

} // namespace

int main() {
    std::cout << "=== Running HTTP API Contract Tests ===\n";
    testReadEndpoints();
    testInsertionAndIsolation();
    testErrors();
    testManagementAndImport();
    testPersistence();
    std::cout << "=== All API Tests Passed Successfully! ===\n";
    return 0;
}
