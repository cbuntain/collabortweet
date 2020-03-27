exports.getUsers = function(db, cb) {
  db.all("SELECT userId, screenname, fname, lname, isadmin FROM users")
    .then(function(userData) {
      cb(userData);
    });
}

exports.findById = function(db, id, cb) {

  db.get("SELECT userId, screenname, password, fname, lname, isadmin FROM users WHERE userId = ?", id)
    .then(function(userData) {
      cb(null, userData);
    });
}


exports.findByScreenname = function(db, sn, cb) {

    db.get("SELECT userId, screenname, password, fname, lname, isadmin FROM users WHERE screenname = ?", sn)
    .then(function(userData) {
        cb(null, userData);
    });
}
