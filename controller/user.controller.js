const {userModel,propertyModel} = require("../model/user.model")
const jwt = require("jsonwebtoken")
const cloudinary = require("cloudinary")

    cloudinary.config({ 
        cloud_name: 'df3w5r05p', 
        api_key: '249535718223297', 
        api_secret: 'Iu2b2sPL0q0Oein07Ae5UncKefg'
    });


const upload = async (req, res) => {
  try {
    let files = req.body.imageUrl; // array of base64 or URLs
    if (!files || !files.length) {
      return res.send({ status: false, message: "No files provided" });
    }

    // Upload all files in parallel
    const uploadedFiles = await Promise.all(
      files.map((file) =>
        cloudinary.v2.uploader.upload(file).then((result) => result.secure_url)
      )
    );

    res.send({
      status: true,
      message: "Files uploaded successfully !!!",
      myFiles: uploadedFiles,
    });
  } catch (err) {
    console.error("Cloudinary upload error:", err);
    res.send({ status: false, message: "Could not upload files !!!" });
  }
};


const registerUser = (req,res)=>{
    let form = new userModel(req.body)
    form.save()
    .then(()=>{
        console.log("info saved")
        res.send({status:true,message:"Registered successfully"})
    })
    .catch((err)=>{
        console.log(err)
        res.send({status:false,message:"Registeration unsuccessfull"})
    })
}

const uploadProperty= async(req,res)=>{
    const {id} = req.params
    // console.log(req.body)
    // // const {images}= req.body
    console.log('This is yhe request', id)
    try{
        const user = await userModel.findById(id)
        if(user){
            console.log('user found');
        }
        else{
         console.log('user not found');
         
        } 
        user.property.push(req.body)
        await user.save()
        .then((res)=>{
            console.log("property saved",res);
            
        }).catch((err)=>{
            console.log("property not saved",err);
            
        })
        
    }catch(err){

        console.log(err);
        
    }
}

const signIn = (req,res) =>{
    let {email} = req.body
    let password = req.body.password
    console.log(email)
    userModel.findOne({email:email})
    .then((user)=>{
        if(!user){
            res.send({status:false, message:"Wrong credentials"})
        }
        else{
            user.validatePassword(password,(err,same)=>{
                if(!same){
                    res.send({status:false, message:"Wrong credentials"})
                }else{
                    let secret = process.env.SECRET
                    let token = jwt.sign({email},secret,{expiresIn:"1h"})
                    res.send({status:true,message:"Signin succesfull",token})
                }
            })
            console.log(user)
        }
    })
    .catch((err)=>{
        console.log(err)
    })

}
const getDashboard= (req,res)=>{
    let token = req.headers.authorization.split(" ")[1]
    let secret = process.env.SECRET
    jwt.verify(token,secret,(err,result)=>{
        if(err){
            res.send({status:false})
        }
        else{
            userModel.findOne({email : result.email})
            .then((user)=>{
                if(!user){
                    console.log("")
                }else{
                    res.send({status:true, message:"Welcome",result,user})
                }
            })
        }
    })
}

const getAllProperties= (req,res)=>{
    userModel.find()
    .then((allprop)=>{
        if(allprop){
            res.send({status:true,allprop})
        }
    })
}

module.exports = {registerUser, signIn, getDashboard, uploadProperty, getAllProperties,upload}