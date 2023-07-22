const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');

const router = express.Router();
const server = express();
const port = 1000;

// Connect to MongoDB
mongoose.connect('mongodb://0.0.0.0:27017/userdb', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Create a User model
const User = mongoose.model('User', {
  fullName: String,
  username: String,
  email: String,
  phone: String,
  password: String,
});

//Create a Book model
const Book = mongoose.model('Book', {
  bookName: String,
  bookAuthor: String,
  bookGenre: String,
  bookAbout: String,
  fullName: String,
  phoneNumber: String,    
  reasonWhy: String, 
  bookAvailabilityStatus: String,
  bookImage: String,      
});


//Create a BorrowedBook model
const BorrowedBook = mongoose.model('BorrowedBook', {
  bookName: String,
  bookAuthor: String,
  bookGenre: String,
  bookAbout: String,
  borrowerFullName: String,
  borrowerPhoneNumber: String,
  reasonWhy: String,
  borrowDate: Date,
  returnDate: Date,
  status: String, 
});

server.use(express.static('public'));

// Set up session middleware
server.use(
  session({
    secret: 'your-secret-key',
    resave: true,
    saveUninitialized: true,
    cookie: {
      maxAge: 10 * 60 * 1000, // Set session timeout to 10 minutes (10 minutes * 60 seconds * 1000 milliseconds)
    },
  })
);

// Set up the storage engine for multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/'); // Define the destination folder for uploaded images
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9); // Generate a unique filename
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

// Set up multer for handling file uploads with the 'image' field name
const upload = multer({ storage });


// Parse incoming request bodies
server.use(bodyParser.urlencoded({ extended: true }));

// Set EJS as the view engine
server.set('view engine', 'ejs');


// Start the server
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});


// Home route - display user list
server.get('/', (req, res) => {
  // Check if user is authenticated and session has not expired
  const authenticated = req.session.authenticated && req.session.cookie.expires > new Date();

  Book.find({})
    .exec()
    .then(books => {
      if (authenticated) {
        res.render('index', { books, authenticated });
      } else {
        // Render a simplified book list without availability status
        const simplifiedBookList = books.map(book => {
          return {
            _id: book._id,
            bookName: book.bookName,
            bookAuthor: book.bookAuthor,
            bookGenre: book.bookGenre,
          };
        });
        res.render('index', { books: simplifiedBookList, authenticated });
      }
    })
    .catch(err => {
      console.log('Error fetching books:', err);
      res.send('An error occurred while fetching books.');
    });
});


// Register route - display registration form
server.get('/register', (req, res) => {
  res.render('register');
});

// Register route - handle registration form submission
server.post('/register', (req, res) => {
  const { fullName, username, phone, password } = req.body;

  // Create a new user in the database
  const newUser = new User({ fullName, username, phone });
  newUser.password = password;
  newUser
    .save()
    .then(() => {
      res.redirect('/login');
    })
    .catch(err => {
      console.log('Error creating user:', err);
      res.send('An error occurred while creating the user.');
    });
});



// Login route - display login form
server.get('/login', (req, res) => {
  res.render('login');
});

// Login route - handle form submission
server.post('/login', (req, res) => {
  const { username, password, role } = req.body;

  if (role === 'borrower') {
    // Authenticate borrower user by querying the database
    User.findOne({ username: username, password: password })
      .then(user => {
        if (user) {
          req.session.authenticated = true;
          res.redirect('/availableBooks'); // Redirect to the availableBooks page
        } else {
          res.send('Invalid username or password.');
        }
      })
      .catch(err => {
        console.log('Error finding user:', err);
        res.send('An error occurred while finding the user.');
      });
  } else if (role === 'lender') {
    // Authenticate lender user with specific username and password
    if (username === 'admin' && password === 'password') {
      req.session.authenticated = true;
      res.redirect('/homePageLender'); // Redirect to the addBook page
    } else {
      res.send('Invalid username or password.');
    }
  } else {
    res.send('Invalid role.');
  }
});

//---------------------------------------------------------------------------------------------------------

// Home page for lender - display lender options and book list
server.get('/homePageLender', (req, res) => {
  // Check if user is authenticated and session has not expired
  if (req.session.authenticated && req.session.cookie.expires > new Date()) {
    // Fetch all books from the database
    Book.find({})
      .exec()
      .then(books => {
        res.render('homePageLender', { books, authenticated: true });
      })
      .catch(err => {
        console.log('Error fetching books:', err);
        res.send('An error occurred while fetching books.');
      });
  } else {
    req.session.authenticated = false; // Mark session as expired
    res.render('notification', { message: 'Session has expired. Please log in again.' });
  }
});

//-----------------------------------------------------------------------------------------------------------

// Logout route
server.get('/logout', (req, res) => {
  req.session.authenticated = false;
  res.redirect('/');
});

//---------------------------------------------------------------------------------------------------------------------------------------
// Route to render addBook.ejs view
server.get('/addBook', (req, res) => {
  // Check if user is authenticated and session has not expired
  if (req.session.authenticated && req.session.cookie.expires > new Date()) {
    res.render('addBook');
  } else {
    req.session.authenticated = false; // Mark session as expired
    res.render('notification', { message: 'Session has expired. Please log in again.' });
  }
});

// Route to handle the form submission for adding a new book with an image
server.post('/createBook', upload.single('bookImage'), (req, res) => {
  // Check if user is authenticated and session has not expired
  if (req.session.authenticated && req.session.cookie.expires > new Date()) {
    const { bookName, bookAuthor, bookGenre, bookAbout } = req.body;
    
     // Get the file path of the uploaded image
    const imagePath = req.file ? req.file.filename : '';

     // Create a new book in the database with the imagePath included
  const newBook = new Book({
    bookName,
    bookAuthor,
    bookGenre,
    bookAbout,
    bookImage: imagePath, // Save the file path in the database
    fullName: req.session.authenticated.fullName,
    phoneNumber: req.session.authenticated.phone,
    reasonWhy: req.session.authenticated.role, // Assuming you have a role property in the User model
    bookAvailabilityStatus: 'Available',
  });

    newBook
      .save()
      .then(() => {
        res.redirect('/homePageLender');
      })
      .catch(err => {
        console.log('Error creating book:', err);
        res.send('An error occurred while creating the book.');
      });
  } else {
    req.session.authenticated = false; // Mark session as expired
    res.render('notification', { message: 'Session has expired. Please log in again.' });
  }
});

//-------------------------------------------------------------------------------------------------------------------------------

// Route to handle deleting a book
server.get('/deleteBook/:bookId', (req, res) => {
  // Check if user is authenticated and session has not expired
  if (req.session.authenticated && req.session.cookie.expires > new Date()) {
    const bookId = req.params.bookId;

    // Find the book by its ID in the database and remove it
    Book.findByIdAndRemove(bookId)
      .then(book => {
        if (!book) {
          return res.send('Book not found.');
        }

        res.redirect('/homePageLender');
      })
      .catch(err => {
        console.log('Error deleting book:', err);
        res.send('An error occurred while deleting the book.');
      });
  } else {
    req.session.authenticated = false; // Mark session as expired
    res.render('notification', { message: 'Session has expired. Please log in again.' });
  }
});

//-------------------------------------------------------------------------------------------------------------------------------

// Route to render editBook.ejs view
server.get('/editBook/:bookId', (req, res) => {
  // Check if user is authenticated and session has not expired
  if (req.session.authenticated && req.session.cookie.expires > new Date()) {
    const bookId = req.params.bookId;

    // Find the book by its ID in the database
    Book.findById(bookId)
      .then(book => {
        if (!book) {
          return res.send('Book not found.');
        }

        res.render('editBook', { book, authenticated: true });
      })
      .catch(err => {
        console.log('Error finding book:', err);
        res.send('An error occurred while finding the book.');
      });
  } else {
    req.session.authenticated = false; // Mark session as expired
    res.render('notification', { message: 'Session has expired. Please log in again.' });
  }
});

// Route to handle updating a book
server.post('/updateBook/:bookId', (req, res) => {
  // Check if user is authenticated and session has not expired
  if (req.session.authenticated && req.session.cookie.expires > new Date()) {
    const bookId = req.params.bookId;
    const { bookName, bookAuthor, bookGenre, bookAbout } = req.body;

    // Find the book by its ID in the database and update it
    Book.findByIdAndUpdate(bookId, { bookName, bookAuthor, bookGenre, bookAbout })
      .then(book => {
        if (!book) {
          return res.send('Book not found.');
        }

        res.json({ message: 'Book updated successfully.' });
      })
      .catch(err => {
        console.log('Error updating book:', err);
        res.send('An error occurred while updating the book.');
      });
  } else {
    req.session.authenticated = false; // Mark session as expired
    res.render('notification', { message: 'Session has expired. Please log in again.' });
  }
});
//----------------------------------------------------------------------------------------------------------------------------

// Route to render acceptanceBook.ejs view
server.get('/acceptanceBook', (req, res) => {
  // Check if user is authenticated and session has not expired
  if (req.session.authenticated && req.session.cookie.expires > new Date()) {
    // Find all requested books in the database with status set to 'requested'
    BorrowedBook.find({ status: 'requested' })
      .then(requestedBooks => {
        // Pass the requestedBooks array to the acceptanceBook.ejs template
        res.render('acceptanceBook', { requestedBooks, authenticated: true });
      })
      .catch(err => {
        console.log('Error finding requested books:', err);
        res.send('An error occurred while finding the requested books.');
      });
  } else {
    req.session.authenticated = false; // Mark session as expired
    res.render('notification', { message: 'Session has expired. Please log in again.' });
  }
});


// Route to handle book acceptance/rejection
server.post('/acceptRequest/:bookId', (req, res) => {
  const bookId = req.params.bookId;
  const { statusBook } = req.body;

  // Find the requested book by its ID in the database
  BorrowedBook.findById(bookId)
    .then(book => {
      if (!book) {
        return res.send('Requested book not found.');
      }

      if (statusBook === 'accept') {
        // Update the status of the book to "accepted"
        book.status = 'accepted';
      } else if (statusBook === 'reject') {
        // Update the status of the book to "rejected"
        book.status = 'rejected';
        // Render the giveReason page and pass the book details to the view
        return res.render('giveReason', { book });
      } else {
        return res.send('Invalid status.');
      }

      // Save the updated book status in the database
      book.save()
        .then(() => {
          res.render('notification', { message: 'Book acceptance/rejection confirmed.' });
        })
        .catch(err => {
          console.log('Error saving book status:', err);
          res.send('An error occurred while saving the book status.');
        });
    })
    .catch(err => {
      console.log('Error finding requested book:', err);
      res.send('An error occurred while finding the requested book.');
    });
});

//-------------------------------------------------------------------------------------------------------------------------------

// Route to render returnBook.ejs view
server.get('/returnBook', (req, res) => {
  // Check if user is authenticated and session has not expired
  if (req.session.authenticated && req.session.cookie.expires > new Date()) {
    // Replace "BorrowedBook" with the actual model name you are using for the borrowed books
    BorrowedBook.find({})
      .exec()
      .then(borrowedBooks => {
        res.render('returnBook', { borrowedBooks, authenticated: true });
      })
      .catch(err => {
        console.log('Error fetching borrowed books:', err);
        res.send('An error occurred while fetching borrowed books.');
      });
  } else {
    req.session.authenticated = false; // Mark session as expired
    res.render('notification', { message: 'Session has expired. Please log in again.' });
  }
});

//------------------------------------------------------------------------------------------------------------------------------

// Route to handle book return action
server.post('/returnAction/:bookId', (req, res) => {
  const bookId = req.params.bookId;

  // Find the requested book by its ID in the database
  BorrowedBook.findById(bookId)
    .then(borrowedBook => {
      if (!borrowedBook) {
        return res.send('Requested book not found.');
      }

      // Update the status of the book to "Returned" in the borrowedBook record
      borrowedBook.status = 'Returned';

      // Save the updated borrowedBook in the database
      return borrowedBook.save();
    })
    .then(updatedBorrowedBook => {
      // Find the corresponding book by its name and author in the database
      return Book.findOne({
        bookName: updatedBorrowedBook.bookName,
        bookAuthor: updatedBorrowedBook.bookAuthor,
      });
    })
    .then(book => {
      if (!book) {
        return res.send('Book not found.');
      }

      // Update the availability status of the book to "Available" in the Book record
      book.bookAvailabilityStatus = 'Available';

      // Save the updated book in the database
      return book.save();
    })
    .then(() => {
      // Remove the book from the BorrowedBook collection after it has been returned
      return BorrowedBook.findByIdAndRemove(bookId);
    })
    .then(() => {
      // Redirect back to the returnBook page after the book is returned
      res.redirect('/returnBook');

      // Show the success message after the book is returned
      req.session.returnSuccess = true;
    })
    .catch(err => {
      console.log('Error updating book status:', err);
      res.send('An error occurred while updating the book status.');
    });
});


//-------------------------------------------------------------------------------------------------------------------------------
// Route to handle the submission of the reason for rejecting the book request
server.post('/submitReason/:bookId', (req, res) => {
  // Check if user is authenticated and session has not expired
  if (req.session.authenticated && req.session.cookie.expires > new Date()) {
    const bookId = req.params.bookId;
    const { reason } = req.body;

    // Find the requested book by its ID in the database
    BorrowedBook.findById(bookId)
      .then(book => {
        if (!book) {
          return res.send('Requested book not found.');
        }

        // Update the reason for rejection in the book record
        book.reasonWhy = reason;
        book.status = 'rejected'; // Set the status to "rejected" again to indicate the rejection

        // Save the updated book in the database
        book.save()
          .then(() => {
            res.render('notification', { message: 'Reason for rejection submitted successfully.' });
          })
          .catch(err => {
            console.log('Error saving book:', err);
            res.send('An error occurred while saving the book.');
          });
      })
      .catch(err => {
        console.log('Error finding requested book:', err);
        res.send('An error occurred while finding the requested book.');
      });
  } else {
    req.session.authenticated = false; // Mark session as expired
    res.render('notification', { message: 'Session has expired. Please log in again.' });
  }
});

//-------------------------------------------------------------------------------------------------------------------------------
// Route to render availableBooks.ejs view when logged in as borrower
server.get('/availableBooks', (req, res) => {
  // Check if user is authenticated and session has not expired
  if (req.session.authenticated && req.session.cookie.expires > new Date()) {
    // Fetch all available books from the database
    Book.find({ bookAvailabilityStatus: 'Available' })
      .exec()
      .then(books => {
        res.render('availableBooks', { books, authenticated: true });
      })
      .catch(err => {
        console.log('Error fetching available books:', err);
        res.send('An error occurred while fetching available books.');
      });
  } else {
    req.session.authenticated = false; // Mark session as expired
    res.render('notification', { message: 'Session has expired. Please log in again.' });
  }
});
//-------------------------------------------------------------------------------------------------------------------------

// Route to render search.ejs view with search results
server.get('/search', (req, res) => {
  // Check if user is authenticated and session has not expired
  const authenticated = req.session.authenticated && req.session.cookie.expires > new Date();

  // Get the search term from the query parameters
  const searchTerm = req.query.term;

  // Search books by the provided search term in the database
  Book.find({
    $or: [
      { bookName: { $regex: searchTerm, $options: 'i' } },
      { bookAuthor: { $regex: searchTerm, $options: 'i' } },
      { bookGenre: { $regex: searchTerm, $options: 'i' } },
    ],
  })
    .exec()
    .then(books => {
      res.render('search', { books, searchTerm, authenticated });
    })
    .catch(err => {
      console.log('Error searching books:', err);
      res.send('An error occurred while searching books.');
    });
});


//--------------------------------------------------------------------------------------------------------------------------

// Route to render requestBook.ejs view
server.get('/requestBook/:bookId', (req, res) => {
  // Check if user is authenticated and session has not expired
  if (req.session.authenticated && req.session.cookie.expires > new Date()) {
    const bookId = req.params.bookId;

    // Find the book by its ID in the database
    Book.findById(bookId)
      .then(book => {
        if (!book) {
          return res.send('Book not found.');
        }

        res.render('requestBook', { book, authenticated: true });
      })
      .catch(err => {
        console.log('Error finding book:', err);
        res.send('An error occurred while finding the book.');
      });
  } else {
    req.session.authenticated = false; // Mark session as expired
    res.render('notification', { message: 'Session has expired. Please log in again.' });
  }
});

// Route to handle the book borrowing request and store it in borrowedBook collection
server.post('/requestBook/:bookId', (req, res) => {
  // Check if user is authenticated and session has not expired
  if (req.session.authenticated && req.session.cookie.expires > new Date()) {
    const bookId = req.params.bookId;
    const { fullName, borrowDate, returnDate, reasonWhy } = req.body;

    // Find the book by its ID in the database
    Book.findById(bookId)
      .then(book => {
        if (!book) {
          return res.send('Book not found.');
        }

        if (book.bookAvailabilityStatus === 'Available') {
          // Create a new borrowedBook record in the database
          const newBorrowedBook = new BorrowedBook({
            bookName: book.bookName,
            bookAuthor: book.bookAuthor,
            bookGenre: book.bookGenre,
            bookAbout: book.bookAbout,
            borrowerFullName: fullName,
            borrowerPhoneNumber: req.session.authenticated.phone,
            reasonWhy,
            borrowDate, // Include borrow date in the borrowedBook record
            returnDate, // Include return date in the borrowedBook record
            status: 'requested', // Set the status to 'requested' when saving the borrowedBook record
          });

          newBorrowedBook
            .save()
            .then(() => {
              // Update the availability status of the book to "Unavailable"
              book.bookAvailabilityStatus = 'Unavailable';
              return book.save();
            })
            .then(() => {
              res.render('notification', {
                message: 'Book borrowing request submitted successfully.',
              });
            })
            .catch(err => {
              console.log('Error saving borrowed book:', err);
              res.send('An error occurred while saving the borrowed book.');
            });
        } else {
          res.send('Book is not available for borrowing.');
        }
      })
      .catch(err => {
        console.log('Error finding book:', err);
        res.send('An error occurred while finding the book.');
      });
  } else {
    req.session.authenticated = false; // Mark session as expired
    res.render('notification', { message: 'Session has expired. Please log in again.' });
  }
});



//-----------------------------------------------------------------------------------------------

// Assume you have a BorrowedBook model/schema

// Route to render borrowedBook.ejs view
server.get('/borrowedBooks', (req, res) => {
  // Check if user is authenticated and session has not expired
  if (req.session.authenticated && req.session.cookie.expires > new Date()) {
    const borrowerPhoneNumber = req.session.authenticated.phone;

    // Find the borrowed books by the borrower's phone number in the database
    BorrowedBook.find({ borrowerPhoneNumber })
      .then(books => {
        res.render('borrowedBook', { books, authenticated: true });
      })
      .catch(err => {
        console.log('Error finding borrowed books:', err);
        res.send('An error occurred while finding the borrowed books.');
      });
  } else {
    req.session.authenticated = false; // Mark session as expired
    res.render('notification', { message: 'Session has expired. Please log in again.' });
  }
});

//------------------------------------------------------------------------------------------------

// Route to handle the book borrowing request and store it in BorrowedBook collection
server.post('/borrowBook/:bookId', (req, res) => {
  // Check if user is authenticated and session has not expired
  if (req.session.authenticated && req.session.cookie.expires > new Date()) {
    const bookId = req.params.bookId;
    const { fullName, borrowDate, returnDate, reasonWhy } = req.body;

    // Find the book by its ID in the database
    Book.findById(bookId)
      .then(book => {
        if (!book) {
          return res.send('Book not found.');
        }

        if (book.bookAvailabilityStatus === 'Available') {
          // Create a new BorrowedBook record in the database
          const newBorrowedBook = new BorrowedBook({
            bookName: book.bookName,
            bookAuthor: book.bookAuthor,
            bookGenre: book.bookGenre,
            bookAbout: book.bookAbout,
            borrowerFullName: fullName,
            borrowerPhoneNumber: req.session.authenticated.phone,
            reasonWhy,
            borrowDate,
            returnDate,
          });

          newBorrowedBook
            .save()
            .then(() => {
              // Update the availability status of the book to "Unavailable"
              book.bookAvailabilityStatus = 'Unavailable';
              return book.save();
            })
            .then(() => {
              res.render('notification', {
                message: 'Book borrowing request submitted successfully.',
              });
            })
            .catch(err => {
              console.log('Error saving borrowed book:', err);
              res.send('An error occurred while saving the borrowed book.');
            });
        } else {
          res.send('Book is not available for borrowing.');
        }
      })
      .catch(err => {
        console.log('Error finding book:', err);
        res.send('An error occurred while finding the book.');
      });
  } else {
    req.session.authenticated = false; // Mark session as expired
    res.render('notification', { message: 'Session has expired. Please log in again.' });
  }
});

//------------------------------------------------------------------------------------------------

// Add the route to render the borrowingStatus.ejs view
server.get('/borrowingStatus', (req, res) => {
  // Check if user is authenticated and session has not expired
  if (req.session.authenticated && req.session.cookie.expires > new Date()) {
    const borrowerPhoneNumber = req.session.authenticated.phone;

    // Find the borrowed books by the borrower's phone number in the database
    BorrowedBook.find({ borrowerPhoneNumber })
      .then(borrowedBooks => {
        res.render('borrowingStatus', { borrowedBooks, authenticated: true });
      })
      .catch(err => {
        console.log('Error finding borrowed books:', err);
        res.send('An error occurred while finding the borrowed books.');
      });
  } else {
    req.session.authenticated = false; // Mark session as expired
    res.render('notification', { message: 'Session has expired. Please log in again.' });
  }
});

// Add the route to handle viewing the rejection reason
server.get('/viewRejectionReason/:bookId', (req, res) => {
  // Check if user is authenticated and session has not expired
  if (req.session.authenticated && req.session.cookie.expires > new Date()) {
    const bookId = req.params.bookId;

    // Find the book by its ID in the BorrowedBook collection
    BorrowedBook.findById(bookId)
      .then(book => {
        if (!book) {
          return res.send('Book not found.');
        }

        // Render the viewRejectionReason.ejs view and pass the book details to it
        res.render('viewRejectionReason', { book, authenticated: true });
      })
      .catch(err => {
        console.log('Error finding book:', err);
        res.send('An error occurred while finding the book.');
      });
  } else {
    req.session.authenticated = false; // Mark session as expired
    res.render('notification', { message: 'Session has expired. Please log in again.' });
  }
});


//------------------------------------------------------------------------------------------------

// Route to render bookDescription.ejs view with book details
server.get('/bookDescription/:bookId', (req, res) => {
  // Check if user is authenticated and session has not expired
  if (req.session.authenticated && req.session.cookie.expires > new Date()) {
    const bookId = req.params.bookId;

    // Find the book by its ID in the database
    Book.findById(bookId)
      .then(book => {
        if (!book) {
          return res.send('Book not found.');
        }

        res.render('bookDescription', { book, authenticated: true });
      })
      .catch(err => {
        console.log('Error finding book:', err);
        res.send('An error occurred while finding the book.');
      });
  } else {
    req.session.authenticated = false; // Mark session as expired
    res.render('notification', { message: 'Session has expired. Please log in again.' });
  }
});

//--------------------------------------------------------------------------------------------------


