const fs = require('fs');
const sharp = require("sharp");
const Book = require('../models/book');

exports.createBook = (req, res, next) => {
  const bookObject = JSON.parse(req.body.book);
  delete bookObject._id;
  delete bookObject._userId;
  sharp(req.file.path).resize(450).toFile(`images/resized_${req.file.filename}`)
    .then(() => {
      const book = new Book({
        ...bookObject,
        userId: req.auth.userId,
        imageUrl: `${req.protocol}://${req.get('host')}/images/resized_${req.file.filename}`
      });
      book.save()
        .then(() => { res.status(201).json({ message: 'Objet enregistré !' }) })
        .catch(error => { res.status(400).json({ error }) })
    })
    .catch((error) => {
      res.status(500).json({ error })
    })
};

exports.getOneBook = (req, res, next) => {
  Book.findOne({
    _id: req.params.id
  }).then(
    (book) => {
      res.status(200).json(book);
    }
  ).catch(
    (error) => {
      res.status(404).json({
        error: error
      });
    }
  );
};

exports.modifyBook = (req, res, next) => {

  let bookObject

  const modifyBookProcess = () => {
    delete bookObject._userId;
    Book.findOne({ _id: req.params.id })
      .then((book) => {
        if (book.userId != req.auth.userId) {
          res.status(401).json({ message: 'Not authorized' });
        } else {
          Book.updateOne({ _id: req.params.id }, { ...bookObject, _id: req.params.id })
            .then(() => res.status(200).json({ message: 'Objet modifié!' }))
            .catch(error => res.status(401).json({ error }));
        }
      })
      .catch((error) => {
        res.status(400).json({ error });
      });
  }

  if (req.file) {
    sharp(req.file.path).resize(450).toFile(`images/resized_${req.file.filename}`)
      .then(() => {
        bookObject = {
          ...JSON.parse(req.body.book),
          imageUrl: `${req.protocol}://${req.get('host')}/images/resized_${req.file.filename}`
        }
      })
      .then(() => modifyBookProcess())
      .catch((error) => {
        res.status(500).json({ error })
      })
  } else {
    bookObject = { ...req.body };
    modifyBookProcess()
  }
  
}

exports.deleteBook = (req, res, next) => {
  Book.findOne({ _id: req.params.id })
    .then(book => {
      if (book.userId != req.auth.userId) {
        res.status(401).json({ message: 'Not authorized' });
      } else {
        const filename = book.imageUrl.split('/images/')[1];
        fs.unlink(`images/${filename}`, () => {
          book.deleteOne({ _id: req.params.id })
            .then(() => { res.status(200).json({ message: 'Objet supprimé !' }) })
            .catch(error => res.status(401).json({ error }));
        });
      }
    })
    .catch(error => {
      res.status(500).json({ error });
    });
};

exports.getAllBooks = (req, res, next) => {
  Book.find().then(
    (books) => {
      res.status(200).json(books);
    }
  ).catch(
    (error) => {
      res.status(400).json({
        error: error
      });
    }
  );
};

exports.createRating = (req, res, next) => {
  Book.findOne({ _id: req.params.id })
    .then((book) => {
      let totalRatings = 0
      let finalRating = 0
      for (let rating of book.ratings) {
        if (rating.userId === req.body.userId)
          res.status(401).json({ message: 'Utilisateur a déjà noté' })
        else {
          totalRatings += rating.grade
        }
      }
      totalRatings += req.body.rating
      finalRating = totalRatings / (book.ratings.length + 1)
      finalRating = finalRating.toPrecision(2)

      Book.updateOne({ _id: req.params.id }, { averageRating: finalRating, $push: { ratings: { userId: req.body.userId, grade: req.body.rating } } })
        .then(() => {
          Book.findOne({ _id: req.params.id })
            .then((book) => res.status(200).json(book))
            .catch(error => res.status(500).json({ error }))
        })
        .catch(error => res.status(401).json({ error }));
    })
    .catch((error) => {
      res.status(400).json({ error });
    });
}

exports.getBestRating = (req, res) => {
  Book.find().then(
    (books) => {
      if (books.length <= 3)
        res.status(200).json(books);
      else {
        let topThreeBooks = [...books]
        topThreeBooks.sort((bookOne, bookTwo) => bookTwo.averageRating - bookOne.averageRating)
        topThreeBooks = topThreeBooks.slice(0, 3)
        res.status(200).json(topThreeBooks)
      }
    }
  ).catch(
    (error) => {
      res.status(400).json({
        error: error
      });
    }
  );
}