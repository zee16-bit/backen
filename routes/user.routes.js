const express = require("express")
const route = express.Router()
const { registerUser, signIn, getDashboard, uploadProperty, getAllProperties, upload} = require("../controller/user.controller")

route.post("/register",registerUser )
route.post("/signin" ,signIn)
route.post("/image",upload)
route.get("/dashboard", getDashboard)
route.post("/upload/:id", uploadProperty)
route.get("/allproperty", getAllProperties)
module.exports = route