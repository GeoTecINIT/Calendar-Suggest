var fs = require('fs');

var readline = require('readline');
var google = require('googleapis');
var googleAuth = require('google-auth-library');

//Load MongoDB service
var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');

//Load services keys
var Keys = JSON.parse(fs.readFileSync('keys.json', 'utf8'));

  
var MongoUrl = Keys.MongoUrl;
var GoogleKeys = {
      apiKey: Keys.GoogleKeys.apikey, // for Mapquest, OpenCage, Google Premier 
      formatter: null         // 'gpx', 'string', ... 
  }; 
  // Load foursquare service
var foursquare = require('node-foursquare-venues')(Keys.FoursquareKeys.clientid, Keys.FoursquareKeys.clientsecret);

// Load Google Geocoder
var geocoderProvider = 'google';
var httpAdapter = 'https';
var geocoder = require('node-geocoder')(geocoderProvider, httpAdapter, GoogleKeys);

var costo = ['Muy Bajo', 'Bajo', 'Medio', 'Alto', 'Muy Alto'];
// If modifying these scopes, delete your previously saved credentials
// at ~/.credentials/calendar-nodejs-quickstart.json
var SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];
var TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH ||
    process.env.USERPROFILE) + '/.credentials/';
var TOKEN_PATH = TOKEN_DIR + 'calendar-nodejs-quickstart.json';

// Load client secrets from a local file.
fs.readFile('client_secret.json', function processClientSecrets(err, content) {
  if (err) {
    console.log('Error loading client secret file: ' + err);
    return;
  }
  // Authorize a client with the loaded credentials, then call the
  // Google Calendar API.
  authorize(JSON.parse(content), listEvents);
});

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 *
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
  var clientSecret = credentials.installed.client_secret;
  var clientId = credentials.installed.client_id;
  var redirectUrl = credentials.installed.redirect_uris[0];
  var auth = new googleAuth();
  var oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, function(err, token) {
    if (err) {
      getNewToken(oauth2Client, callback);
    } else {
      oauth2Client.credentials = JSON.parse(token);
      callback(oauth2Client);
    }
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 *
 * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback to call with the authorized
 *     client.
 */
function getNewToken(oauth2Client, callback) {
  var authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES
  });
  console.log('Authorize this app by visiting this url: ', authUrl);
  var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  rl.question('Enter the code from that page here: ', function(code) {
    rl.close();
    oauth2Client.getToken(code, function(err, token) {
      if (err) {
        console.log('Error while trying to retrieve access token', err);
        return;
      }
      oauth2Client.credentials = token;
      storeToken(token);
      callback(oauth2Client);
    });
  });
}

/**
 * Store token to disk be used in later program executions.
 *
 * @param {Object} token The token to store to disk.
 */
function storeToken(token) {
  try {
    fs.mkdirSync(TOKEN_DIR);
  } catch (err) {
    if (err.code != 'EEXIST') {
      throw err;
    }
  }
  fs.writeFile(TOKEN_PATH, JSON.stringify(token));
  console.log('Token stored to ' + TOKEN_PATH);
}

/**
 * Lists the next 10 events on the user's primary calendar.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
function listEvents(auth) {
  var calendar = google.calendar('v3');
  calendar.events.list({
    auth: auth,
    calendarId: 'primary',
    timeMin: (new Date()).toISOString(),
    maxResults: 2,
    singleEvents: true,
    orderBy: 'startTime'
  }, function(err, response) {
    if (err) {
      console.log('The API returned an error: ' + err);
      return;
    }
    var events = response.items;
    if (events.length == 0) {
     // console.log('No upcoming events found.');
    } else {
   // console.log('Upcoming 10 events:');
      for (var i = 0; i < events.length; i++) {
        var event = events[i];
        var start = event.start.dateTime || event.start.date;
		eloc = event.location
		if(eloc){
			// buscar las coordenadas
			geocoder.geocode(eloc, function(err, res){	
				if(err){console.log('geocoder error: '+err);}
				else{
					var latlng = res[0].latitude+','+res[0].longitude;
					foursquare.venues.explore({ll: latlng, query: 'bar'}, function(error, response){
						if (error) { return console.error('foursquare error: '+error) }
						var venues = response.response.groups[0].items;
							console.log('Lugares recomendados por Foursquare:');
						  // imprimir cada lugar por su nombre
						  for (var i = 10; i >= 0; i--) {
						  	console.log(venues[i].venue.name+' en '+venues[i].venue.location.address+' con una valoración de '+venues[i].venue.rating);
						  }
					});
					
				}
			});
			
		}
        console.log('%s - %s', start, event.summary);
      }
	  saveEvents(events);
    }
  });
}

function saveEvents(events){
	MongoClient.connect(MongoUrl, function(err, db) {
	  assert.equal(null, err);
	  var col = db.collection('col_sug');
	  var inserCol = col.insert(events);
	  console.log(inserCol);
	  db.close();
	});
}

