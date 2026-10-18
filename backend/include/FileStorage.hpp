#ifndef HIERARCHY_FILE_STORAGE_HPP
#define HIERARCHY_FILE_STORAGE_HPP

#include <string>
#include <cstdio>
#include <cerrno>
#ifdef _WIN32
#include <windows.h>
#else
#include <sys/stat.h>
#include <unistd.h>
#endif

namespace FileStorage {
inline bool createDirectory(const std::string& path) {
#ifdef _WIN32
    return CreateDirectoryA(path.c_str(), nullptr) || GetLastError() == ERROR_ALREADY_EXISTS;
#else
    return mkdir(path.c_str(), 0700) == 0 || errno == EEXIST;
#endif
}
inline bool exists(const std::string& path) {
#ifdef _WIN32
    if (GetFileAttributesA(path.c_str()) != INVALID_FILE_ATTRIBUTES) return true;
    const DWORD error = GetLastError();
    return error != ERROR_FILE_NOT_FOUND && error != ERROR_PATH_NOT_FOUND;
#else
    struct stat info;
    return stat(path.c_str(), &info) == 0 || errno != ENOENT;
#endif
}
inline bool replaceFile(const std::string& temporary, const std::string& target) {
#ifdef _WIN32
    return MoveFileExA(temporary.c_str(), target.c_str(), MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH) != 0;
#else
    return std::rename(temporary.c_str(), target.c_str()) == 0;
#endif
}
}
#endif
