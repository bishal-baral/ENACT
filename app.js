const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const session = require("express-session");

// Models!
const Event = require('./models/Event')


//*******************************************
//***********Controllers*********************

const courseController = require('./controllers/courseController');
const resourceController = require('./controllers/resourceController');
const profileController = require('./controllers/profileController');
const notificationController = require('./controllers/notificationController');
const messageController = require('./controllers/messageController');
const eventController = require('./controllers/eventController');


//*******************************************
//***********Database connection*************

// const MONGODB_URI = 'mongodb://localhost/ENACT';
const MONGODB_URI = process.env.MONGODB_URI_IND || 'mongodb://localhost/ENACT';
const mongoose = require('mongoose');

// Makes connection asynchronously.  Mongoose will queue up database
// operations and release them when the connection is complete.
mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useCreateIndex: true,
    useUnifiedTopology: true
});
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function () {
    console.log("mongo connected")
});

const app = express();

//*******************************************
//***********AWS S3 storage setup************
const aws = require('aws-sdk');

/*
* Configure the AWS region of the target bucket.
* Remember to change this to the relevant region.
*/
aws.config.region = 'us-east-2';

const S3_BUCKET = process.env.S3_BUCKET || 'enact-resources'

/*
* Respond to GET requests to /signAWS.
* Upon request, return JSON containing the temporarily-signed S3 request and
* the anticipated URL of the image.
*/
app.get('/sign-s3', (req, res) => {
    const s3 = new aws.S3({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    });
    const fileName = req.query['file-name'];
    const fileType = req.query['file-type'];
    const s3Params = {
        Bucket: S3_BUCKET,
        Key: fileName,
        Expires: 60,
        ContentType: fileType,
        ACL: 'public-read'
    };

    s3.getSignedUrl('putObject', s3Params, (err, data) => {
        if (err) {
            console.log(err);
            return res.end();
        }
        const returnData = {
            signedRequest: data,
            url: `https://${S3_BUCKET}.s3.amazonaws.com/${fileName}`
        };
        res.write(JSON.stringify(returnData));
        res.end();
    });
});


//*******************************************
//***********Middleware setup****************

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// register middleware
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({extended: false}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    secret: 'keyboard cat',
    resave: false,
    saveUninitialized: false,
}));

// configure auth router
const auth = require('./routes/auth')
app.use(auth)

//*******************************************
//***********Index page router***************

//we can use this or the index router to handle req
app.get('/',
    resourceController.checkUserName,
    resourceController.loadPublicResources,
    (req, res) =>
        res.render('./pages/index'))

//*******************************************
//***********Course related******************

app.get('/course',
    resourceController.checkUserName,
    (req, res) =>
        res.render('./pages/createCourse'))

// rename this to /createCourse and update the ejs form
app.post('/course',
    courseController.createNewClass,
    courseController.addToOwnedCourses
)

app.get('/courses',
    resourceController.checkUserName,
    (req, res) =>
        res.render('./pages/showCourses')
)

app.get('/course/:courseId',
    resourceController.checkUserName,
    courseController.showOneCourse,
    resourceController.loadResources
)

// render join course view
app.get('/course/join',
    resourceController.checkUserName,
    (req, res) => {
        res.render('./pages/joinACourse')
    }
)

// process join course
app.post('/course/join',
    courseController.joinCourse
)

//*******************************************
//***********Resource related****************

app.get('/uploadToCourse/:courseId',
    resourceController.checkUserName,
    (req, res) => {
        res.render('./pages/uploadToCourse', {
            req: req
        })
    })

app.post('/uploadResource/:courseId',
    resourceController.uploadResource
)

app.get('/resources/search/private/general',
    resourceController.checkUserName,
    (req, res) =>
        res.render('./pages/searchPrimary')
)

app.get('/uploadToPublic',
    resourceController.checkUserName,
    (req, res) =>
        res.render('./pages/uploadToPublic')
)

app.post('/uploadToPublicResr',
    resourceController.uploadToPublicResr
)

app.post('/resources/search/private/general',
    resourceController.primarySearch
)

app.get('/resources/search/private/advanced',
    resourceController.checkUserName,
    (req, res) =>
        res.render('./pages/search'))

app.post('/resources/search/private/advanced',
    resourceController.advancedSearch
)


app.get('/resources/view/public/all',
    resourceController.checkUserName,
    resourceController.showPublic
)

app.get('/resources/search/public/general',
    resourceController.checkUserName,
    (req, res) =>
        res.render('./pages/publicPrimarySearch')
)

app.post('/resources/view/public/generalResult',
    resourceController.primaryPublicSearch
)

app.get('/resources/search/public/advanced',
    resourceController.checkUserName,
    (req, res) =>
        res.render('./pages/publicSearch'))

app.post('/resources/view/public/advancedResult',
    resourceController.advancedSearchPublic
)

app.get('/resources/view/faculty',
    resourceController.checkUserName,
    resourceController.loadAllFacultyResources,
    (req, res) =>
        res.render('./pages/facultyGuide')
)

app.get('/resources/view/faculty/:contentType',
    resourceController.checkUserName,
    resourceController.loadSpecificContentType,
)



app.get('/uploadToFaculty',
    resourceController.checkUserName,
    (req, res) =>
        res.render('./pages/uploadToFaculty')
)

app.post('/uploadToFacultyExclusive',
    resourceController.uploadResource
)

app.post('/updateResource/:resourceId',
    resourceController.updateResource
)

app.post('/removeResource/:resourceId',
    resourceController.removeResource
)

app.post('/removePublicResource/:resourceId',
    resourceController.removePublicResource
)

app.post('/postPublicResource/:resourceId',
    resourceController.postPublicResource
)

app.get('/showStarredResources',
    resourceController.checkUserName,
    resourceController.showStarredResources
)

app.post('/starResource/:resourceId',
    resourceController.starResource
)

app.post('/unstarResource/:resourceId',
    resourceController.unstarResource
)

app.post('/starResourceAlt/:resourceId',
    resourceController.starResourceAlt
)

app.post('/unstarResourceAlt/:resourceId',
    resourceController.unstarResourceAlt
)

app.get('/myResourcesFaculty',
    resourceController.checkUserName,
    resourceController.showMyResources
)

app.get('/myResourcesStudent',
    resourceController.checkUserName,
    resourceController.showMyResourcesStudent
)

app.post('/studentUpdateResource/:resourceId',
    resourceController.studentUpdateResource
)

app.get('/managePublicResources',
    resourceController.loadAllPublicResources,
    (req, res) =>
        res.render('./pages/managePublicResources')
)

app.get('/collection/view/:resourceSetId',
    resourceController.loadCollection,
    (req, res) =>
        res.render('./pages/showCollection')
)

app.post('/removeFromCollection/:collectionId/:resourceId',
    resourceController.removeFromCollection
)

app.post('/addToCollection/:collectionId/:resourceId',
    resourceController.addToCollection
)

app.post('/createCollection',
    resourceController.createCollection
)

app.post('/deleteCollection/:collectionId',
    resourceController.deleteCollection
)
//*******************************************
//***********Notification related************

app.get('/reviewResource',
    resourceController.checkUserName,
    notificationController.loadUnderReviewResources
)

app.post('/approve',
    notificationController.approve
)

app.post('/toPublic',
    notificationController.toPublic
)

app.post('/tempdeny',
    notificationController.deny
)

app.post('/resumeResource/:resourceId',
    notificationController.resume
)

app.post('/commentResource/:resourceId',
    notificationController.comment
)

app.post('/sendDeny',
    notificationController.sendDeny
)

app.get('/approvePublicResources',
    notificationController.loadPartPublicResources
)
app.post('/partPublicToPublic',
    notificationController.partPublicToPublic
)

app.post('/partPublicToENACT',
    notificationController.partPublicToENACT
)

app.get('/secretFunction',
    resourceController.resetWord2Id
)

//*******************************************
//***********Profile related*****************

//show all profiles from all users
app.get('/profile/view/:id',
    (req, res, next) => {
        if (res.locals.user.userName === undefined) {
            res.render('./pages/updateProfile')
        } else {
            next()
        }
    },
    profileController.findOneUser
)

app.get('/profiles/view/faculty',
    profileController.showFacultyProfiles
)

app.get('/profile/update',
    (req, res) => {
        res.render('./pages/updateProfile')
    })

app.get('/profiles/view/all',
    resourceController.checkUserName,
    profileController.showAllProfiles
)

//show all profiles from all users
app.post('/profile/update',
    profileController.updateProfile
)

app.get('/profiles/faculty/assign',
    resourceController.checkUserName,
    profileController.loadFaculty
)

app.post('/profiles/faculty/assign',
    profileController.assignFaculty
)
//show all profiles from all users
app.post('/saveProfileImageURL',
    profileController.updateProfileImageURL
)

//*******************************************
//************Message related****************
app.get('/messages/view/:sender/:receiver/:resourceId',
    resourceController.checkUserName,
    messageController.loadMessagingPage
)

app.post('/messages/save/:sender/:receiver/:resourceId',
    messageController.saveMessage
)

app.get('/messages/view/all',
    resourceController.checkUserName,
    messageController.loadMessageBoard
)

app.get('/showDenied',
    notificationController.loadDeniedResources
)

app.get('/approvedResources',
    notificationController.loadApprovedResources
)

app.get('/showPublic',
    notificationController.loadMyPublicResources
)

//*******************************************
//*************Event related*****************

app.get('/events',
    async (req, res) => {
        let eventsInfo = await Event.find({}).sort({start: -1})
        res.locals.eventsInfo = eventsInfo
        res.render('./pages/calendar')
    }
)

app.get('/events/all',
    async (req, res) => {
        let now = new Date();
        let eventsInfo;
        if (res.locals.loggedIn) {
            eventsInfo = await Event.find({}).sort({start: -1})
        } else {
            eventsInfo = await Event.find({visibility: 'public'}).sort({start: -1})
        }
        for (let i = 0; i < eventsInfo.length; i++) {
            eventsInfo[i].start = new Date(eventsInfo[i].start - (now.getTimezoneOffset() * 60000))
            eventsInfo[i].end = new Date(eventsInfo[i].end - (now.getTimezoneOffset() * 60000))
        }
        return res.send(eventsInfo)
    }
)

app.post('/event/delete/:eventId',
    eventController.deleteEvent
)

app.post('/event/edit/:eventId',
    eventController.editEvent
)

app.post('/event/save',
    eventController.saveEvent
)

//*******************************************
//*************Error related*****************

// catch 404 and forward to error handler
app.use(function (req, res, next) {
    next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};
    // render the error page
    res.status(err.status || 500);
    res.send("error message: " + err.message);
});

module.exports = app;