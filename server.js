var express = require('express');
var session = require('cookie-session');
var bodyParser = require('body-parser');
var app = express();
var http = require('http');
var url = require('url');
var fs = require('fs');
var formidable = require('formidable');
var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');
var ObjectID = require('mongodb').ObjectID;
var mongo = require('mongodb');

var mongourl = "mongodb://miniproj:mini381@ds117334.mlab.com:17334/miniproj";

app = express();
app.set('view engine','ejs');

var SECRETKEY1 = 'I want to pass COMPS381F';
var SECRETKEY2 = 'Keep this to yourself';

app.use(session({
  name: 'session',
  keys: [SECRETKEY1,SECRETKEY2]
}));

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static('public'));

//redirect to login.
app.get('/',function(req,res) {
	console.log(req.session);
	if (!req.session.authenticated) {
    res.redirect('/login');
	} else {
    //res.status(200); doesn't work if add this
    //console.log("Login successfully");
    //console.log({name:req.session.username});
		res.redirect('/list');
	}
});

// 1: render to login.
app.get('/login',function(req,res) {
  res.render('login');
});

// 1: render to logout.
app.get('/logout',function(req,res) {
  req.session = null;
  res.redirect('/');
});

// 1: render to create account.
app.get('/createAccount',function(req,res) {
  res.render('createAccount');
});

// 2: render to create new restaurant.
app.get('/new',function(req,res) {
  if(req.session.username == ""||req.session.username == null){
      res.redirect('/login');
    }
    else{
  res.render('new',{session:req.session.username});}
});

// 3: render to update restaurants.
app.get('/update',function(req,res) {
  if(req.session.username == ""||req.session.username == null){
      res.redirect('/login');
    }
    else{
  var restaurant_id = new mongo.ObjectID(req.query.id);
  var query1 = {_id: restaurant_id};
  console.log("MongoClient connect() succeed!");
  MongoClient.connect(mongourl,function(err,db) {
    console.log("MongoClient connect() succeed!");
    checkRestaurant(db,query1,function(result) {
      db.close();
      console.log(result[0]);
    if(result[0].owner!=req.session.username){
    res.redirect('/wronguser');
    }
    else{
      res.render('update',{result:result[0],session:req.session.username});
    }
  })
  })}
});

// 4: render to rate restaurants.
app.get('/rate',function(req,res) {
  if(req.session.username == ""||req.session.username == null){
      res.redirect('/login');
    }
    else{
  var restaurant_id = new mongo.ObjectID(req.query.id);
  var query1 = {_id: restaurant_id};
  MongoClient.connect(mongourl,function(err,db) {
    console.log("MongoClient connect() succeed!!!");
    checkRestaurant(db,query1,function(result) {
      db.close();
      console.log(result[0]);
      var have =0;
      result[0].grades.forEach(function(grade){
        if(grade.user==req.session.username){ 
          have = 1;
        }
      })
      if(have ==1){
      res.redirect('/rated');
      }
      else {
      res.render('rate',{id: req.query.id,session:req.session.username});  
      }
  })
  })
  }
});

// render to rated
app.get('/rated',function(req,res) {
  res.render('rated');
});

// 7: render to search restaurants
app.get('/search',function(req,res) {
  if(req.session.username == ""||req.session.username == null){
      res.redirect('/login');
    }
  else{res.render('search',{session:req.session.username});}
});

// if not the owner of the restaurant
app.get('/wronguser',function(req,res) {
  res.render('wronguser');
});

// 1a: create record in mongodb:collection(accounts) 
app.post('/createAccount',function(req,res) {
  MongoClient.connect(mongourl, function(err,db) {
    try {
      assert.equal(err,null);
    } catch (err) {
      res.writeHead(500,{"Content-Type":"text/plain"}); //render error msg
      res.end("MongoClient connect() failed!");
    }
    /*
    if (err !== null) {
      res.writeHead(500,{"Content-Type":"text/plain"}); //render error msg
      res.end("MongoClient connect() failed!");
      return
    }
    console.log("MongoClient connect() succeed!");
    */
    var r = {};
    r.name = req.body.name;
    r.password = req.body.password;
    db.collection('user').insertOne(r,function(err) {
      assert.equal(err,null);
      db.close();
      //console.log("insert was successful!");
      res.redirect('/');
    });
  });
});

// 1b: check login. store userid in cookie session
app.post('/login',function(req,res) {
  MongoClient.connect(mongourl, function(err,db) {
    try {
      assert.equal(err,null);
    } catch (err) {
      res.writeHead(500,{"Content-Type":"text/plain"}); //render error msg
      res.end("MongoClient connect() failed!");
    }
    var r = {};
    r.name = req.body.name;
    r.password = req.body.password;
    var cursor = db.collection('user').find(r);
    var result = [];
    cursor.each(function(err, doc) {
      assert.equal(err, null);
      if (doc != null) {
        result.push(doc);
      }
    }); 
    req.session.authenticated = true;
    req.session.username = r.name;
    res.redirect('/');
  });
});

// 2: create record in mongodb:collection(restaurants)
app.post('/new',function(req,res) {

  var owner = req.session.name;
    var form = new formidable.IncomingForm();
    form.parse(req, function (err, fields, files) {
      var filename = files.filetoupload.path;
      if (fields.title) {
        var title = (fields.title.length > 0) ? fields.title : "untitled";
      }
      if (files.filetoupload.type) {
        var mimetype = files.filetoupload.type;
      }
      console.log("title = " + title);
      console.log("filename = " + filename);
      fs.readFile(filename, function(err,data) {
        MongoClient.connect(mongourl,function(err,db) {
          try {
            assert.equal(err,null);
          } catch (err) {
            res.writeHead(500,{"Content-Type":"text/plain"});
            res.end("MongoClient connect() failed!");
          }
          console.log("MongoClient connect() succeed!");
          if(files.filetoupload!=null){
            var image = new Buffer(data).toString('base64');
          }
          else{
            var image = null;
          }
          var r = {"name": fields.name, "borough": fields.borough,"cuisine":fields.cuisine, "photo": image, "photo_minetype": mimetype, 
              "address": {"street": fields.street, "building": fields.building, "zipcode": fields.zipcode, 
                        "coord": [fields.lon, fields.lat]}, 
              "grades":[],
              "owner" : req.session.username
              };
          insertRestaurants(db, r,function(result) {
            db.close();
            res.render('created');
          })
        })
      });
    });
});


// 3: update record in mongodb:collection(restaurants) only by owner
app.post('/update',function(req,res) {

  var owner = req.session.name;

  
    var form = new formidable.IncomingForm();
    console.log('test');
    form.parse(req, function (err, fields, files) {
      console.log('test2');
      var filename = files.filetoupload.path;
      if (fields.title) {
        var title = (fields.title.length > 0) ? fields.title : "untitled";
      }
      if (files.filetoupload.type) {
        var mimetype = files.filetoupload.type;
      }
      console.log("title = " + title);
      console.log("filename = " + filename);
      fs.readFile(filename, function(err,data) {
        MongoClient.connect(mongourl,function(err,db) {
          try {
            assert.equal(err,null);
          } catch (err) {
            res.writeHead(500,{"Content-Type":"text/plain"});
            res.end("MongoClient connect() failed!");
          }
          console.log("MongoClient connect() succeed!");
          var image;
          var r;
          if(files.filetoupload != null && files.filetoupload != "" ){
            image = new Buffer(data).toString('base64');
            var r = {"name": fields.name, "borough": fields.borough,"cuisine":fields.cuisine, "photo": image, "photo_minetype": mimetype, 
              "address": {"street": fields.street, "building": fields.building, "zipcode": fields.zipcode, 
                        "coord": [fields.lon, fields.lat]}, 
              "owner" : req.session.username
              };
          }
          else{
            var r = {"name": fields.name, "borough": fields.borough,"cuisine":fields.cuisine, "photo_minetype": mimetype, 
              "address": {"street": fields.street, "building": fields.building, "zipcode": fields.zipcode, 
                        "coord": [fields.lon, fields.lat]}, 
              "owner" : req.session.username
              };
          }

        
          
          var restaurant_id = new mongo.ObjectID(req.query.id);
          console.log(restaurant_id);
          var query = {_id: restaurant_id};
          console.log(query);

     
              updateRestaurants(db,query, r,function(result) {
              db.close();
              res.redirect('/display?id='+req.query.id);
              })
          
        })
      });
    });
  
});

// 4: update rate record in mongodb:collection(restaurants)
app.post('/rate',function(req,res) {

  
  var form = new formidable.IncomingForm();
  console.log('test');
    form.parse(req, function (err, fields, files) {
      console.log('test2');
        MongoClient.connect(mongourl,function(err,db) {
          try {
            assert.equal(err,null);
          } catch (err) {
            res.writeHead(500,{"Content-Type":"text/plain"});
            res.end("MongoClient connect() failed!");
          }
          console.log("MongoClient connect() succeed!");
          var r = {"grades": {"user": req.session.username, "score": fields.score}};
          console.log("Test Score");
          console.log(fields.test);
          console.log(fields.score);
          var restaurant_id = new mongo.ObjectID(req.query.id);
          console.log(restaurant_id);
          var query = {_id: restaurant_id};
        console.log(query);
        rateRestaurants(db,query, r,function(result) {
          db.close();
	  console.log(result);
          res.render('ratesuccess');
        })
      })
  });
  
});

// list all the restaurants
 app.get('/list',function(req,res) {   
 if(req.session.username == ""||req.session.username == null){
      res.redirect('/login');
    } 

   else{
    MongoClient.connect(mongourl,function(err,db) {
          try {
            assert.equal(err,null);
          } catch (err) {
            res.writeHead(500,{"Content-Type":"text/plain"});
            res.end("MongoClient connect() failed!");
          }
          
          console.log("MongoClient connect() succeed!");

      listRestaurants(db,function(result){     
      db.close();

      res.render('list', {result:result,session:req.session.username});

      
    });
  });
  } 
});

// 5: display restaurant detail of a restaurant
app.get('/display',function(req,res) {    
    if(req.session.username == ""||req.session.username == null){
      res.redirect('/login');
    }
    else{
    MongoClient.connect(mongourl,function(err,db) {
          try {
            assert.equal(err,null);
          } catch (err) {
            res.writeHead(500,{"Content-Type":"text/plain"});
            res.end("MongoClient connect() failed!");
          }
          var restaurant_id = new mongo.ObjectID(req.query.id);
          var query = {_id: restaurant_id};
          console.log("MongoClient connect() succeed!");
      
      displayRestaurants(db,query,function(result){     
      db.close();
      res.render('display', {result:result[0],session:req.session.username});
    });
  });
  }
});

// 5: connect to google map
app.get("/gmap", function(req,res) {
  res.render("gmap.ejs", {
    lat:req.query.lat,
    lon:req.query.lon,
    zoom:req.query.zoom
  });
  res.end();
});



// 6: delete restaurant by owner
app.get('/delete',function(req,res) { 

    if(req.session.username == ""||req.session.username == null){
      res.redirect('/login');
    }   
    else{
    MongoClient.connect(mongourl,function(err,db) {
          try {
            assert.equal(err,null);
          } catch (err) {
            res.writeHead(500,{"Content-Type":"text/plain"});
            res.end("MongoClient connect() failed!");
          }

          var restaurant_id = new mongo.ObjectID(req.query.id);
          var query = {_id: restaurant_id , owner: req.session.username};
          console.log("MongoClient connect() succeed!");

      deleteRestaurants(db,query,function(result){     
      db.close();
      console.log(result);
      res.render('deleted');

      
    });
  });
  }
});



// 7: search restaurant
app.post("/search", function(req,res) {
  var form = new formidable.IncomingForm();
    console.log('test');
    console.log(form);
    form.parse(req, function (err, fields, files) {
      console.log('test2');

        MongoClient.connect(mongourl,function(err,db) {
          try {
            assert.equal(err,null);
          } catch (err) {
            res.writeHead(500,{"Content-Type":"text/plain"});
            res.end("MongoClient connect() failed!");
          }
          console.log("MongoClient connect() succeed!");

          var query = {name :fields.field};
          console.log("Test search");
          console.log(fields.searchBy);
          console.log(fields.field);
        console.log(query);
        search(db,query,function(result) {
        db.close();
        res.render('searchlist',{result:result,session:req.session.username});

        })
      
    });
});
});

// 8(name): get by restful services
app.get('/api/restaurant/name/:name',function(req,res){
    var query = {name:req.params.name};
    MongoClient.connect(mongourl,function(err,db) {
          try {
            assert.equal(err,null);
          } catch (err) {
            res.writeHead(500,{"Content-Type":"text/plain"});
            res.end("MongoClient connect() failed!");
          }
          console.log("MongoClient connect() succeed!");
        search(db,query,function(result) {
        db.close();
        res.status(200).json(result).end();

        })
});});

// 8(name): get by restful services
app.get('/api/restaurant/borough/:borough',function(req,res){
    var query = {name:req.params.borough};
    MongoClient.connect(mongourl,function(err,db) {
          try {
            assert.equal(err,null);
          } catch (err) {
            res.writeHead(500,{"Content-Type":"text/plain"});
            res.end("MongoClient connect() failed!");
          }
          console.log("MongoClient connect() succeed!");
        search(db,query,function(result) {
        db.close();
        res.status(200).json(result).end();

        })
});});

// 8(cuisine): get by restful services
app.get('/api/restaurant/cuisine/:cuisine',function(req,res){
    var query = {name:req.params.cuisine};
    MongoClient.connect(mongourl,function(err,db) {
          try {
            assert.equal(err,null);
          } catch (err) {
            res.writeHead(500,{"Content-Type":"text/plain"});
            res.end("MongoClient connect() failed!");
          }
          console.log("MongoClient connect() succeed!");
        search(db,query,function(result) {
        db.close();
        res.status(200).json(result).end();

        })
    
});});






function insertRestaurants(db,r,callback) {
  db.collection('restaurantTest').insertOne(r,function(err,result) {
    assert.equal(err,null);
    console.log("insert was successful!");
    callback(result);
  });
}

function updateRestaurants(db, query, r,callback) {
  db.collection('restaurantTest').update(query, {$set : r},function(err,result) {
    assert.equal(err,null);
    console.log("update was successful!");
    callback(result);
  });
}

function rateRestaurants(db, query, r,callback) {
  db.collection('restaurantTest').update(query, {$push: r},function(err,result) {
    assert.equal(err,null);
    console.log("rate was successful!");
    callback(result);
  });
}

function displayRestaurants(db,query,callback){
  var result = [];
  var cursor = db.collection('restaurantTest').find(query);
    
  cursor.each(function(err, doc) {
    assert.equal(err, null); 
    if (doc != null) {
      result.push(doc);
    } else {
      callback(result);
    }
  });
}

function checkRestaurant(db,query1,callback){ 
  var result = [];
  var cursor = db.collection('restaurantTest').find(query1);
    
  cursor.each(function(err, doc) {
    assert.equal(err, null); 
    if (doc != null) {
      result.push(doc);
    } else {
      callback(result);
    }
  });
}

function checkRateRestaurant(db,query1,query2,callback){ 
  var result = [];
  var cursor = db.collection('restaurantTest').find({query1,query2});
    
  cursor.each(function(err, doc) {
    assert.equal(err, null); 
    if (doc != null) {
      result.push(doc);
    } else {
      callback(result);
    }
  });
}

function listRestaurants(db,callback){
  var result = [];
  var cursor = db.collection('restaurantTest').find();
    
  cursor.each(function(err, doc) {
    assert.equal(err, null); 
    if (doc != null) {
      result.push(doc);
    } else {
      callback(result);
    }
  });
}

function search(db,query,callback){
  var result = [];
  var cursor = db.collection('restaurantTest').find(query);
    
  cursor.each(function(err, doc) {
    assert.equal(err, null); 
    if (doc != null) {
      result.push(doc);
    } else {
      callback(result);
    }
  });
}

function deleteRestaurants(db,query,callback){ 
  db.collection('restaurantTest').remove(query,function(err,result) {
    assert.equal(err,null);
    console.log("delete was successful!");
    callback(result);
  });
}



 

app.listen(process.env.PORT || 8099); 
