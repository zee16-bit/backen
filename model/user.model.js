const { default: mongoose } = require("mongoose");
const bcrypt = require("bcryptjs")
let propertySchema = mongoose.Schema({
    description: {type: String},
    details: {type: String},
    numberofrooms: {type: Number},
    type: {type: String},
    size: {type: Number},
    location: {type: String},
    price: {type: Number},
    images: {type: Array},
})
let userSchema = mongoose.Schema({
    firstname: {type: String, required: true},
    lastname:{type: String, required: true},
    email:{type: String, required: true, unique:true},
    password:{type: String,required:true},
    // registrationTime :{type:Date, default:Date.now()},
    property:[propertySchema]
})

let saltRound = 10

userSchema.pre("save", function(next){
    if (!this.isModified("password")) return next();
    bcrypt.hash(this.password, saltRound, (err, hashedPassword)=>{
        console.log(hashedPassword)
        if(err){
            console.log(err)
        }
        else{
            this.password = hashedPassword
            next()
        }
    })
})

userSchema.methods.validatePassword = function(password, callback){
    bcrypt.compare(password,this.password,(err,same)=>{
            callback(err,same)
    })
}



let userModel = mongoose.model("user", userSchema)

module.exports ={userModel}