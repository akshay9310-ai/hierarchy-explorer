#ifndef HIERARCHY_JSON_HPP
#define HIERARCHY_JSON_HPP

#include <map>
#include <vector>
#include <string>
#include <stdexcept>
#include <cctype>

// Small strict JSON reader for portable hierarchy files; no external runtime.
struct Json {
    enum Kind { Null, String, Object, Array, Primitive } kind = Null;
    std::string text;
    std::map<std::string, Json> object;
    std::vector<Json> array;
    const Json& at(const std::string& key) const {
        auto it = object.find(key);
        if (kind != Object || it == object.end()) throw std::runtime_error("Missing field: " + key);
        return it->second;
    }
    std::string string() const {
        if (kind != String) throw std::runtime_error("Expected a JSON string");
        return text;
    }
    static Json parse(const std::string& source) {
        size_t pos = 0;
        Json value = read(source, pos, 0);
        space(source, pos);
        if (pos != source.size()) throw std::runtime_error("Unexpected trailing JSON data");
        return value;
    }
private:
    static void space(const std::string& s, size_t& p) {
        while (p < s.size() && (s[p] == ' ' || s[p] == '\n' || s[p] == '\r' || s[p] == '\t')) ++p;
    }
    static unsigned hex(const std::string& s, size_t& p) {
        unsigned value = 0;
        for (int i = 0; i < 4; ++i) {
            if (p == s.size()) throw std::runtime_error("Incomplete Unicode escape");
            char c = s[p++];
            int digit = c >= '0' && c <= '9' ? c - '0' : c >= 'a' && c <= 'f' ? c - 'a' + 10 : c >= 'A' && c <= 'F' ? c - 'A' + 10 : -1;
            if (digit < 0) throw std::runtime_error("Invalid Unicode escape");
            value = value * 16 + digit;
        }
        return value;
    }
    static void utf8(std::string& out, unsigned c) {
        if (c < 0x80) out += static_cast<char>(c);
        else if (c < 0x800) { out += static_cast<char>(0xc0 | (c >> 6)); out += static_cast<char>(0x80 | (c & 63)); }
        else if (c < 0x10000) { out += static_cast<char>(0xe0 | (c >> 12)); out += static_cast<char>(0x80 | ((c >> 6) & 63)); out += static_cast<char>(0x80 | (c & 63)); }
        else { out += static_cast<char>(0xf0 | (c >> 18)); out += static_cast<char>(0x80 | ((c >> 12) & 63)); out += static_cast<char>(0x80 | ((c >> 6) & 63)); out += static_cast<char>(0x80 | (c & 63)); }
    }
    static std::string quoted(const std::string& s, size_t& p) {
        if (p == s.size() || s[p++] != '"') throw std::runtime_error("Expected quoted string");
        std::string out;
        while (p < s.size()) {
            char c = s[p++];
            if (c == '"') return out;
            if (static_cast<unsigned char>(c) < 32) throw std::runtime_error("Control character in string");
            if (c != '\\') { out += c; continue; }
            if (p == s.size()) break;
            c = s[p++];
            switch (c) {
                case '"': case '\\': case '/': out += c; break;
                case 'b': out += '\b'; break;
                case 'f': out += '\f'; break;
                case 'n': out += '\n'; break;
                case 'r': out += '\r'; break;
                case 't': out += '\t'; break;
                case 'u': {
                    unsigned code = hex(s, p);
                    if (code >= 0xd800 && code <= 0xdbff) {
                        if (s.substr(p, 2) != "\\u") throw std::runtime_error("Missing low surrogate");
                        p += 2;
                        unsigned low = hex(s, p);
                        if (low < 0xdc00 || low > 0xdfff) throw std::runtime_error("Invalid low surrogate");
                        code = 0x10000 + ((code - 0xd800) << 10) + low - 0xdc00;
                    } else if (code >= 0xdc00 && code <= 0xdfff) throw std::runtime_error("Invalid surrogate");
                    utf8(out, code); break;
                }
                default: throw std::runtime_error("Invalid string escape");
            }
        }
        throw std::runtime_error("Unterminated string");
    }
    static Json read(const std::string& s, size_t& p, int depth) {
        if (depth > 32) throw std::runtime_error("JSON nesting limit exceeded");
        space(s, p);
        if (p == s.size()) throw std::runtime_error("Unexpected end of JSON");
        Json value;
        char c = s[p];
        if (c == '"') { value.kind = String; value.text = quoted(s, p); return value; }
        if (c == '{' || c == '[') {
            value.kind = c == '{' ? Object : Array;
            char end = c == '{' ? '}' : ']';
            ++p; space(s, p);
            if (p < s.size() && s[p] == end) { ++p; return value; }
            for (;;) {
                space(s, p);
                std::string key;
                if (value.kind == Object) {
                    key = quoted(s, p); space(s, p);
                    if (p == s.size() || s[p++] != ':') throw std::runtime_error("Expected colon");
                }
                Json item = read(s, p, depth + 1);
                if (value.kind == Object) {
                    if (!value.object.emplace(key, item).second) throw std::runtime_error("Duplicate JSON key");
                } else value.array.push_back(item);
                space(s, p);
                if (p == s.size()) throw std::runtime_error("Unterminated container");
                char next = s[p++];
                if (next == end) return value;
                if (next != ',') throw std::runtime_error("Expected comma");
            }
        }
        for (const std::string token : {"null", "true", "false"}) {
            if (s.compare(p, token.size(), token) == 0) { p += token.size(); value.kind = token == "null" ? Null : Primitive; value.text = token; return value; }
        }
        throw std::runtime_error("Unsupported JSON value");
    }
};
#endif
