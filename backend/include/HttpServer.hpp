#ifndef HTTP_SERVER_HPP
#define HTTP_SERVER_HPP

#include <string>
#include "BinaryTree.hpp"

#ifdef _WIN32
#include <winsock2.h>
#include <ws2tcpip.h>
typedef int socklen_t;
#else
#include <sys/types.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <unistd.h>
#include <errno.h>
#include <cstring>
#include <signal.h>
typedef int SOCKET;
#define INVALID_SOCKET (-1)
#define SOCKET_ERROR   (-1)
#define closesocket(s) close(s)
#endif

/**
 * @brief Cross-platform, single-threaded HTTP REST Server
 * supporting Windows Winsock2 and Linux POSIX sockets.
 *
 * Runs cleanly on MinGW Windows development environments and
 * cloud container environments (e.g. Render Docker with Linux).
 */
class HttpServer {
public:
    explicit HttpServer(int port = 8080, const std::string& dataDirectory = "");
    ~HttpServer();

    // Prevent copy/assignment
    HttpServer(const HttpServer&) = delete;
    HttpServer& operator=(const HttpServer&) = delete;

    // Lifecycle
    bool start();
    void run(int maxRequests = -1); // -1 runs indefinitely; positive integer runs N requests
    void stop();

    int getPort() const { return port; }

    // Routes a parsed request and returns a complete HTTP response.
    // Public to support deterministic API contract tests without opening a socket.
    std::string routeRequest(const std::string& method, const std::string& target,
                             const std::string& body = "", const std::string& origin = "");

private:
    int port;
    SOCKET listenSocket;
    bool isRunning;
    std::string configuredOrigin;
    BinaryTree orgTree;
    BinaryTree familyTree;
    std::string dataDirectory;
    bool readOnlyStorage = false;
    bool saveTree(const std::string& mode, const BinaryTree& tree);
    void importTree(const std::string& body, const std::string& mode, BinaryTree& tree);

    void handleClient(SOCKET clientSocket);
    void initializeFixtures();
    BinaryTree* treeForMode(const std::string& mode);
    std::string hierarchyJson(const std::string& mode, const BinaryTree& tree) const;
    std::string traversalJson(const std::string& mode, const std::string& type,
                              const BinaryTree& tree) const;
    std::string statsJson(const BinaryTree& tree) const;
    std::string errorResponse(int statusCode, const std::string& statusText,
                              const std::string& error, const std::string& message,
                              const std::string& path, const std::string& origin = "");
    std::string buildResponse(int statusCode, const std::string& statusText,
                              const std::string& contentType, const std::string& body,
                              bool isOptions = false, const std::string& origin = "");
    bool isOriginAllowed(const std::string& origin) const;
    std::string resolveAllowedOrigin(const std::string& origin) const;
};

#endif // HTTP_SERVER_HPP
