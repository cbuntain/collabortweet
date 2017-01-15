var records = [
  { id: 1, username: 'cbuntain', password: 'secret', displayName: 'Cody', emails: [ { value: 'cbuntain@coretx.net' } ] },
  { id: 2, username: 'ecmcgrath', password: 'birthday', displayName: 'Erin', emails: [ { value: 'ecmcgrath@umd.edu' } ] }
];

exports.records = records;

exports.findById = function(id, cb) {
  process.nextTick(function() {
    var idx = id - 1;
    if (records[idx]) {
      cb(null, records[idx]);
    } else {
      cb(new Error('User ' + id + ' does not exist'));
    }
  });
}

exports.findByUsername = function(username, cb) {
  process.nextTick(function() {
    for (var i = 0, len = records.length; i < len; i++) {
      var record = records[i];
      if (record.username === username) {
        return cb(null, record);
      }
    }
    return cb(null, null);
  });
}