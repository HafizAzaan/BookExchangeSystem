const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');

const app = express();
const port = 3003;

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

const Book = mongoose.model('Book', {
  bookName: String,
  bookAuthor: String,
  bookGenre: String,
  bookAbout: String,
  fullName: String,
  phoneNumber: String,    // Borrower's phone number
  reasonWhy: String, 
  bookAvailabilityStatus : String    // Reason for borrowing
});


// Set up session middleware
app.use(
  session({
    secret: 'your-secret-key',
    resave: true,
    saveUninitialized: true,
    cookie: {
      maxAge: 10 * 60 * 1000, // Set session timeout to 10 minutes (10 minutes * 60 seconds * 1000 milliseconds)
    },
  })
);

// Parse incoming request bodies
app.use(bodyParser.urlencoded({ extended: true }));

// Set EJS as the view engine
app.set('view engine', 'ejs');


// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});


// Home route - display user list
app.get('/', (req, res) => {
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
app.get('/register', (req, res) => {
  res.render('register');
});

// Register route - handle registration form submission
app.post('/register', (req, res) => {
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
app.get('/login', (req, res) => {
  res.render('login');
});

// Login route - handle form submission
app.post('/login', (req, res) => {
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



// Home page for lender - display lender options
app.get('/homePageLender', (req, res) => {
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



// Logout route
app.get('/logout', (req, res) => {
  req.session.authenticated = false;
  res.redirect('/');
});


