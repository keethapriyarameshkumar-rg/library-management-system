
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class LibraryServer {

    private static final BookManager manager = new BookManager();

    public static void main(String[] args) throws IOException {
        HttpServer server = HttpServer.create(
            new InetSocketAddress(8080), 0
        );

        server.createContext("/", LibraryServer::handleRequest);
        server.start();

        System.out.println("Digital Library Server started!");
        System.out.println("API running at http://localhost:8080");
    }

    private static void handleRequest(HttpExchange exchange)
            throws IOException {
        try (exchange) {
            exchange.getResponseHeaders().set(
                "Access-Control-Allow-Origin", "*"
            );
            exchange.getResponseHeaders().set(
                "Access-Control-Allow-Methods", "GET, POST, OPTIONS"
            );
            exchange.getResponseHeaders().set(
                "Access-Control-Allow-Headers", "Content-Type"
            );

            if (exchange.getRequestMethod().equals("OPTIONS")) {
                exchange.getResponseHeaders().set(
                    "Access-Control-Allow-Origin", "*"
                );
                exchange.sendResponseHeaders(204, -1);
                return;
            }

            try {
                String path = exchange.getRequestURI().getPath();
                String method = exchange.getRequestMethod();

                if (method.equals("GET") && path.equals("/api/books")) {
                    sendJson(exchange, 200, booksToJson(manager.getAllBooks()));
                }

                else if (method.equals("GET") && path.equals("/api/search")) {
                    Map<String, String> params =
                        parseParams(exchange.getRequestURI().getRawQuery());

                    String keyword = params.getOrDefault("keyword", "");

                    sendJson(exchange, 200,
                        booksToJson(manager.searchBooks(keyword)));
                }

                else if (method.equals("POST") && path.equals("/api/books/add")) {
                    Map<String, String> p = readBody(exchange);

                    int id = Integer.parseInt(p.get("id"));

                    boolean exists = manager.getAllBooks().stream()
                        .anyMatch(book -> book.getId() == id);

                    if (exists) {
                        sendMessage(exchange, 409, false, "Book ID already exists");
                        return;
                    }

                    Book book = new Book(
                        id,
                        p.getOrDefault("title", ""),
                        p.getOrDefault("author", ""),
                        p.getOrDefault("category", ""),
                        p.getOrDefault("isbn", ""),
                        true
                    );

                    if (book.getTitle().isBlank()
                            || book.getAuthor().isBlank()) {
                        sendMessage(exchange, 400, false,
                            "Title and author are required");
                        return;
                    }

                    manager.addBook(book);
                    sendMessage(exchange, 200, true, "Book added successfully");
                }

                else if (method.equals("POST")
                        && path.equals("/api/books/update")) {
                    Map<String, String> p = readBody(exchange);

                    Book book = new Book(
                        Integer.parseInt(p.get("id")),
                        p.getOrDefault("title", ""),
                        p.getOrDefault("author", ""),
                        p.getOrDefault("category", ""),
                        p.getOrDefault("isbn", ""),
                        Boolean.parseBoolean(
                            p.getOrDefault("available", "true"))
                    );

                    boolean updated = manager.updateBook(book);

                    sendMessage(exchange, updated ? 200 : 404,
                        updated, updated ? "Book updated" : "Book not found");
                }

                else if (method.equals("POST")
                        && path.equals("/api/books/delete")) {
                    Map<String, String> p = readBody(exchange);

                    boolean deleted = manager.deleteBook(
                        Integer.parseInt(p.get("id")));

                    sendMessage(exchange, deleted ? 200 : 404,
                        deleted, deleted ? "Book deleted" : "Book not found");
                }

                else if (method.equals("POST")
                        && path.equals("/api/books/issue")) {
                    Map<String, String> p = readBody(exchange);

                    boolean success = manager.issueBook(
                        Integer.parseInt(p.get("id")));

                    sendMessage(exchange, success ? 200 : 400, success,
                        success ? "Book issued successfully"
                                : "Book unavailable or ID not found");
                }

                else if (method.equals("POST")
                        && path.equals("/api/books/return")) {
                    Map<String, String> p = readBody(exchange);

                    boolean success = manager.returnBook(
                        Integer.parseInt(p.get("id")));

                    sendMessage(exchange, success ? 200 : 400, success,
                        success ? "Book returned successfully"
                                : "Book is already available or ID not found");
                }

                else {
                    sendMessage(exchange, 404, false, "API endpoint not found");
                }

            } catch (IllegalArgumentException | IOException e) {
                sendMessage(exchange, 400, false,
                    "Invalid request. Check the supplied details.");
            }
        }
    }

    private static Map<String, String> readBody(HttpExchange exchange)
            throws IOException {
        try (var requestBody = exchange.getRequestBody()) {
            String body = new String(
                requestBody.readAllBytes(),
                StandardCharsets.UTF_8
            );
            return parseParams(body);
        }
    }

    private static Map<String, String> parseParams(String input) {
        Map<String, String> params = new HashMap<>();

        if (input == null || input.isEmpty()) {
            return params;
        }

        for (String pair : input.split("&")) {
            String[] parts = pair.split("=", 2);

            String key = URLDecoder.decode(
                parts[0], StandardCharsets.UTF_8
            );

            String value = parts.length > 1
                ? URLDecoder.decode(parts[1], StandardCharsets.UTF_8)
                : "";

            params.put(key, value);
        }

        return params;
    }

    private static String booksToJson(List<Book> books) {
        StringBuilder json = new StringBuilder("[");

        for (int i = 0; i < books.size(); i++) {
            Book b = books.get(i);

            if (i > 0) {
                json.append(",");
            }

            json.append("{")
                .append("\"id\":").append(b.getId()).append(",")
                .append("\"title\":\"").append(escape(b.getTitle())).append("\",")
                .append("\"author\":\"").append(escape(b.getAuthor())).append("\",")
                .append("\"category\":\"").append(escape(b.getCategory())).append("\",")
                .append("\"isbn\":\"").append(escape(b.getIsbn())).append("\",")
                .append("\"available\":").append(b.isAvailable())
                .append("}");
        }

        return json.append("]").toString();
    }

    private static String escape(String value) {
        return value.replace("\\", "\\\\")
                    .replace("\"", "\\\"")
                    .replace("\n", "\\n")
                    .replace("\r", "\\r")
                    .replace("\t", "\\t");
    }

    private static void sendMessage(
            HttpExchange exchange, int status,
            boolean success, String message) throws IOException {

        String json = "{\"success\":" + success
            + ",\"message\":\"" + escape(message) + "\"}";

        sendJson(exchange, status, json);
    }

    private static void sendJson(
            HttpExchange exchange, int status, String json)
            throws IOException {

        byte[] bytes = json.getBytes(StandardCharsets.UTF_8);

        exchange.getResponseHeaders().set(
            "Content-Type", "application/json; charset=UTF-8"
        );

        exchange.sendResponseHeaders(status, bytes.length);

        try (var output = exchange.getResponseBody()) {
            output.write(bytes);
        }
    }
}