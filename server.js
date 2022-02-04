const express = require('express')
const redis = require('redis')
const ejs = require('ejs')
const bodyParser = require('body-parser')
const shortId = require('shortid')


//Global variables

let setStatus = -1


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

const client = redis.createClient({
    host: '127.0.0.1',
    port: 6379
})

//Redis events listeners

client.on('connect', () => {
    console.log("Connected to Redis...")
})

client.on('end', () => {
    console.log("Disconnected from Redis")
})


//Main endpoint

app.get('/', (req, res) => {
    if(setStatus != -1) {
        res.render('index', { statusMessage: setStatus })
        setStatus = -1
    }else{
        res.render('index', { statusMessage: setStatus })
    }
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
            setStatus = 1
        }
    }, (err) => {
        console.log(err)
    })
    await client.disconnect()
    res.redirect('/')
})

//Useful functions


async function setUrl(fullUrl) {
    let shortUrl = shortId.generate()
    await client.set(fullUrl, shortUrl)
    await client.set(shortUrl, fullUrl)
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