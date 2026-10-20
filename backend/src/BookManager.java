
import java.io.*;
import java.util.ArrayList;
import java.util.List;

class BookManager {

    private final List<Book> books = new ArrayList<>();
    private final String FILE_NAME = "books.txt";

    public BookManager() {
        loadBooks();
    }

    // Add a new book
    public void addBook(Book book) {
        books.add(book);
        saveBooks();
    }

    // Get all books
    public List<Book> getAllBooks() {
        return new ArrayList<>(books);
    }

    // Search books by title, author, ISBN or category
    public List<Book> searchBooks(String keyword) {
        List<Book> result = new ArrayList<>();
        String search = keyword.toLowerCase();

        for (Book book : books) {
            if (book.getTitle().toLowerCase().contains(search)
                    || book.getAuthor().toLowerCase().contains(search)
                    || book.getIsbn().toLowerCase().contains(search)
                    || book.getCategory().toLowerCase().contains(search)) {
                result.add(book);
            }
        }

        return result;
    }

    // Delete a book using its ID
    public boolean deleteBook(int id) {
        boolean removed = books.removeIf(book -> book.getId() == id);

        if (removed) {
            saveBooks();
        }

        return removed;
    }

    // Update book details
    public boolean updateBook(Book updatedBook) {
        for (Book book : books) {
            if (book.getId() == updatedBook.getId()) {
                book.setTitle(updatedBook.getTitle());
                book.setAuthor(updatedBook.getAuthor());
                book.setCategory(updatedBook.getCategory());
                book.setIsbn(updatedBook.getIsbn());
                book.setAvailable(updatedBook.isAvailable());

                saveBooks();
                return true;
            }
        }

        return false;
    }

    // Issue a book
    public boolean issueBook(int id) {
        for (Book book : books) {
            if (book.getId() == id && book.isAvailable()) {
                book.setAvailable(false);
                saveBooks();
                return true;
            }
        }

        return false;
    }

    // Return a book
    public boolean returnBook(int id) {
        for (Book book : books) {
            if (book.getId() == id && !book.isAvailable()) {
                book.setAvailable(true);
                saveBooks();
                return true;
            }
        }

        return false;
    }

    // Save books to a text file
    private void saveBooks() {
        try (PrintWriter writer = new PrintWriter(new FileWriter(FILE_NAME))) {
            for (Book book : books) {
                writer.println(
                    book.getId() + "|" +
                    book.getTitle() + "|" +
                    book.getAuthor() + "|" +
                    book.getCategory() + "|" +
                    book.getIsbn() + "|" +
                    book.isAvailable()
                );
            }
        } catch (IOException e) {
            System.out.println("Error saving books: " + e.getMessage());
        }
    }

    // Load saved books when the application starts
    private void loadBooks() {
        File file = new File(FILE_NAME);

        if (!file.exists()) {
            return;
        }

        try (BufferedReader reader = new BufferedReader(new FileReader(file))) {
            String line;

            while ((line = reader.readLine()) != null) {
                String[] data = line.split("\\|", -1);

                if (data.length == 6) {
                    try {
                        books.add(new Book(
                            Integer.parseInt(data[0]),
                            data[1],
                            data[2],
                            data[3],
                            data[4],
                            Boolean.parseBoolean(data[5])
                        ));
                    } catch (IllegalArgumentException e) {
                        System.out.println("Skipping invalid book record.");
                    }
                }
            }
        } catch (IOException e) {
            System.out.println("Error loading books: " + e.getMessage());
        }
    }
}