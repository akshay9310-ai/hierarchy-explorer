#ifndef HTTP_SERVER_HPP
#define HTTP_SERVER_HPP

#include <string>
#include <winsock2.h>
#include <ws2tcpip.h>

/**
 * @brief Minimal, single-threaded HTTP REST Server proof-of-concept
 * using native Windows Sockets 2.
 *
 * Specifically designed to run cleanly on MinGW.org GCC 6.3 (win32 thread model)
 * without requiring std::thread or external networking libraries.
 */
class HttpServer {
public:
    explicit HttpServer(int port = 8080);
    ~HttpServer();

    // Prevent copy/assignment
    HttpServer(const HttpServer&) = delete;
    HttpServer& operator=(const HttpServer&) = delete;

    // Lifecycle
    bool start();
    void run(int maxRequests = -1); // -1 runs indefinitely; positive integer runs N requests (ideal for tests)
    void stop();

    int getPort() const { return port; }

private:
    int port;
    SOCKET listenSocket;
    bool isRunning;

    void handleClient(SOCKET clientSocket);
    std::string buildResponse(int statusCode, const std::string& statusText,
                              const std::string& contentType, const std::string& body,
                              bool isOptions = false);
};

#endif // HTTP_SERVER_HPP
