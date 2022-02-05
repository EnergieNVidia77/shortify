const express = require('express')
const redis = require('redis')
const ejs = require('ejs')
const bodyParser = require('body-parser')
const shortId = require('shortid')


//Global variables mostly used for adapting UI with backend changes

let setStatus = -1                      //setStatus => [-1 => initial set up, 0 => no change, 1 => change on db]
let url = ''                            //When usr give short url this var is used to the UI the URL corresponding
let shortUrlG = ''                      //Used when the usr is shorting an URL to display him the resulting short URL created

let emails = []
let count = []
let shortUrls = []
let countShortUrls = []  


//Basic set up for express server

const app= express()

app.set('view engine', 'ejs')

app.listen(process.env.PORT || 8080, () => {
    console.log("Server running on localhost:8080")
})

//Middlewares

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended:true}))

//Redis set up

const client = redis.createClient(/*{
    url: 'redis://@db:6379'                                         //Credential for connecting to the container db with docker 
}*/)

//Redis events listeners

client.on('connect', () => {
    console.log("Connected to Redis...")
})

client.on('end', () => {
    console.log("Disconnected from Redis")
})


//Main endpoint

app.get('/', (req, res) => {
    res.render('index', { statusMessage: setStatus, urlResponse: url, shortUrlResponse: shortUrlG, emails: emails, count: count, shortUrls: shortUrls, countShortUrls: countShortUrls})
    setStatus = -1
    url = ''
    shortUrlG = ''
})

//PUSH and GET endpoints

app.post('/push-url', async (req, res) => {
    await client.connect()
    await client.exists(req.body.fullUrl).then( async (reply) => {
        if(reply == 1) {
            console.log("Url exist")
            setStatus = 0
        }else{
            console.log("Url don't exist saving it to Redis")
            await setUrl(req.body.fullUrl)
            await setEmail(req.body.usrEmail)
            await savingEmail(req.body.usrEmail)
            setStatus = 1
        }
    }, (err) => {
        console.log(err)
    })
    await client.disconnect()
    res.redirect('/')
})

app.post('/get-url', async (req, res) => {
    await client.connect()
    await client.exists(req.body.shortUrl).then( async (reply) => {
        if(reply == 1) {
            console.log("Short url exist getting long URL")
            url = await getUrl(req.body.shortUrl)
        }else{
            console.log("Short url don't exist")
            url = 'Error'
        }
    }, (err) => {
        console.log(err)
    })
    client.disconnect()
    res.redirect('/')
})

//Useful functions

async function setUrl(fullUrl) {
    let shortUrl = shortId.generate()
    shortUrlG = shortUrl
    await client.set(fullUrl, shortUrl)
    await client.rPush(shortUrl, fullUrl)
    await client.rPush(shortUrl, 0)
    await savingShortUrl(shortUrl)
}

async function setEmail(usrEmail) {
    let count = 0
    await client.get(usrEmail).then((reply) => {
        if(reply != null){
            reply = parseInt(reply)
            count = reply + 1
        }
    }, (err) => {
        console.log(err)
    })
    if (count == 0) {
        await client.set(usrEmail, 1)
    }else{
        await client.set(usrEmail, count)
    }  
}

async function getUrl(shortUrl) {
    let tmpUrl = ''
    let requestCount = 0
    await client.lRange(shortUrl, 0, 0).then( (reply) => {
        tmpUrl = reply
    }, (err) => {
        console.log(err)
    })
    await client.rPop(shortUrl).then( async (reply) => {
        reply = parseInt(reply)
        requestCount = reply + 1
        await client.rPush(shortUrl, requestCount)
    }, (err) => {
        console.log(err)
    })
    await savingShortUrl(shortUrl)
    return tmpUrl
}

async function savingEmail(usrEmail) {
    if(emails.includes(usrEmail)){
        await client.get(usrEmail).then( (reply) => {
            count[emails.indexOf(usrEmail)] = reply
        }, (err) => {
            console.log(err)
        })
    }else{
        emails.push(usrEmail)
        count.push(1)
    }
}

async function savingShortUrl(shortUrl) {
    if(shortUrls.includes(shortUrl)) {
        await client.lRange(shortUrl, 1, 1).then( (reply) => {
            countShortUrls[shortUrls.indexOf(shortUrl)] = reply
        }, (err) => {
            console.log(err)
        })
    }else{
        shortUrls.push(shortUrl)
        countShortUrls.push(0)
    }
}