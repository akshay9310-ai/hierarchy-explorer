#include "HttpServer.hpp"
#include <iostream>
#include <sstream>
#include <vector>

HttpServer::HttpServer(int p)
    : port(p), listenSocket(INVALID_SOCKET), isRunning(false) {
    WSADATA wsaData;
    int result = WSAStartup(MAKEWORD(2, 2), &wsaData);
    if (result != 0) {
        std::cerr << "[HttpServer] WSAStartup failed: " << result << "\n";
    }
}

HttpServer::~HttpServer() {
    stop();
    WSACleanup();
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

void HttpServer::handleClient(SOCKET clientSocket) {
    char buffer[4096];
    int bytesReceived = recv(clientSocket, buffer, sizeof(buffer) - 1, 0);

    if (bytesReceived > 0) {
        buffer[bytesReceived] = '\0';
        std::string requestStr(buffer);

        // Simple HTTP Request-Line parsing: METHOD PATH HTTP/VERSION
        std::istringstream reqStream(requestStr);
        std::string method, path, version;
        reqStream >> method >> path >> version;

        std::string httpResponse;

        if (method == "OPTIONS") {
            // Handle CORS preflight
            httpResponse = buildResponse(204, "No Content", "text/plain", "", true);
        } else if (method == "GET" && (path == "/api/status" || path == "/api/health")) {
            // Milestone 1 health status endpoint
            std::string jsonBody = "{\"status\":\"ok\","
                                   "\"service\":\"Hierarchy Explorer Backend\","
                                   "\"version\":\"1.0.0-m1\","
                                   "\"compiler\":\"GCC 6.3.0 C++14\","
                                   "\"networking\":\"WinSock2\"}";
            httpResponse = buildResponse(200, "OK", "application/json", jsonBody);
        } else {
            // Unimplemented / 404 handler
            std::string errorBody = "{\"error\":\"Not Found\","
                                    "\"message\":\"Endpoint not yet implemented in Milestone 1\","
                                    "\"path\":\"" + path + "\"}";
            httpResponse = buildResponse(404, "Not Found", "application/json", errorBody);
        }

        send(clientSocket, httpResponse.c_str(), static_cast<int>(httpResponse.length()), 0);
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
