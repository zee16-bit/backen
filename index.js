const express = require("express")
const app = express()
require("dotenv").config()
const mongoose = require("mongoose")
const userRouter = require("./routes/user.routes")
const cors = require("cors")

const PORT = process.env.PORT
const URI = process.env.URI
mongoose.connect(URI)
.then(()=>{
    console.log("Mongoose has connected")
})
.catch((err)=>{
    console.log(err)
})

//midwares
app.use(cors())
app.use(express.urlencoded({extended : true}))
app.use(express.json({limit: '1mb'}))
app.use("/user", userRouter)

app.listen(PORT,(err)=>{
    if(err){
        console.log(err)
    }else{
        console.log(`Server has started at : ${PORT}`)
    }
})