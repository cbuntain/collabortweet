exports.getUsers = function(db, cb) {
  db.all("SELECT userId, screenname, fname, lname FROM users")
    .then(function(userData) {
      cb(userData);
    });
}

exports.findById = function(db, id, cb) {

  db.get("SELECT screenname, fname, lname FROM users WHERE userId = ?", id)
    .then(function(userData) {
      cb(null, userData);
    });
}
