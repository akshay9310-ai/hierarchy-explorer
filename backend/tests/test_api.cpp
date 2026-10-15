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

} // namespace

int main() {
    std::cout << "=== Running HTTP API Contract Tests ===\n";
    testReadEndpoints();
    testInsertionAndIsolation();
    testErrors();
    std::cout << "=== All API Tests Passed Successfully! ===\n";
    return 0;
}
