#include "HttpServer.hpp"
#include <iostream>
#include <string>
#include <cstdlib>

int main(int argc, char* argv[]) {
    int port = 8080;
    const char* portEnv = std::getenv("PORT");
    if (portEnv && *portEnv) {
        try {
            port = std::stoi(portEnv);
        } catch (...) {
            std::cerr << "[Warning] Invalid PORT environment variable: " << portEnv << ", defaulting to 8080\n";
        }
    }

    int maxRequests = -1; // -1 runs indefinitely

    for (int i = 1; i < argc; ++i) {
        std::string arg = argv[i];
        if (arg == "--port" && i + 1 < argc) {
            port = std::stoi(argv[++i]);
        } else if (arg == "--max-requests" && i + 1 < argc) {
            maxRequests = std::stoi(argv[++i]);
        }
    }

    std::cout << "=================================================\n";
    std::cout << "   Hierarchy Explorer — C++ Backend Service      \n";
    std::cout << "   Academic Data Structures Project (Cloud Ready)\n";
    std::cout << "=================================================\n";

    HttpServer server(port);
    if (!server.start()) {
        std::cerr << "[Error] Failed to start HTTP server on port " << port << ".\n";
        return 1;
    }

    std::cout << "Server active on port " << port << " (Health check: /api/status)\n";
    std::cout << "Press Ctrl+C to terminate.\n";

    server.run(maxRequests);

    std::cout << "Server stopped cleanly.\n";
    return 0;
}
