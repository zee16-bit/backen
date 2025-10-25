const { userModel, propertyModel } = require("../model/user.model");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const cloudinary = require("cloudinary");
const { use, param } = require("../routes/user.routes");
require("dotenv").config();

cloudinary.config({
  cloud_name: process.env.CLOUDNAME,
  api_key: process.env.APIKEY,
  api_secret: process.env.APISECRET,
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

const registerUser = (req, res) => {
  let form = new userModel(req.body);
  form
    .save()
    .then(() => {
      console.log("info saved");
      res.send({ status: true, message: "Registered successfully" });
    })
    .catch((err) => {
      console.log(err);
      res.send({ status: false, message: "Registeration unsuccessfull" });
    });
};

const uploadProperty = async (req, res) => {
  const { id } = req.params;

  // // const {images}= req.body
  try {
    const user = await userModel.findById(id);
    user.property.push(req.body);
    await user
      .save()
      .then((result) => {
        if (result) {
          res.send({
            status: true,
            message: "Property uploaded successfully!",
          });
        }
        if (!result) {
          res.send({ status: false, message: "Unable to post property" });
        }
      })
      .catch((err) => {
        console.log("property not saved", err);
      });
  } catch (err) {
    console.log(err);
  }
};

const signIn = (req, res) => {
  let { email } = req.body;
  let password = req.body.password;
  userModel
    .findOne({ email: email })
    .then((user) => {
      if (!user) {
        res.send({ status: false, message: "Wrong credentials" });
      } else {
        user.validatePassword(password, (err, same) => {
          if (!same) {
            res.send({ status: false, message: "Wrong credentials" });
          } else {
            let secret = process.env.SECRET;
            let token = jwt.sign({ email }, secret, { expiresIn: "5h" });
            res.send({ status: true, message: "Signin succesfull", token });
          }
        });
      }
    })
    .catch((err) => {
      console.log(err);
    });
};
const getDashboard = (req, res) => {
  let token = req.headers.authorization.split(" ")[1];
  if (!token) {
    return res
      .status(401)
      .send({ status: false, message: "No token provided" });
  }
  let secret = process.env.SECRET;
  jwt.verify(token, secret, (err, result) => {
    if (err) {
      if (err.name === "TokenExpiredError") {
        res.send({ status: false, message: "TokenExpired" });
      }
      res.send({ status: false, message: "Invalid token" });
    } else {
      userModel.findOne({ email: result.email }).then((user) => {
        if (!user) {
          console.log("");
        } else {
          const totalViews = user.property.reduce((sum, prop) => {
            return sum + (prop.views || 0);
          }, 0);
          const impression = user.property.reduce((sum, prop) => {
            return sum + (prop.messageCount || 0);
          }, 0);
          res.send({
            status: true,
            message: "Welcome",
            result,
            user,
            totalViews,
            impression,
          });
        }
      });
    }
  });
};

const getAllProperties = (req, res) => {
  userModel.find().then((allprop) => {
    if (allprop) {
      res.send({ status: true, allprop });
    }
  });
};

// Update user's profileimage
const saveProfileimage = async (req, res) => {
  const { id } = req.params;
  const { image } = req.body; // frontend sends base64 string

  try {
    // 1. Upload to Cloudinary
    const uploaded = await cloudinary.v2.uploader.upload(image, {
      folder: "profile_images",
    });

    // 2. Save the Cloudinary URL in MongoDB
    const user = await userModel.findByIdAndUpdate(
      id,
      { profileimage: uploaded.secure_url },
      { new: true } // return updated user
    );

    if (!user) {
      return res.status(404).send({ status: false, message: "User not found" });
    }

    res.send({
      status: true,
      message: "Profile image uploaded and saved successfully",
      profileimage: user.profileimage,
    });
  } catch (err) {
    console.error("Error saving profile image:", err);
    res.status(500).send({
      status: false,
      message: "Server error while uploading profile image",
    });
  }
};
let agentEmail = null;
const getProduct = async (req, res) => {
  try {
    const { id } = req.params;

    // Find the user who owns this property
    const user = await userModel.findOne({ "property._id": id });
    if (!user) {
      return res.status(404).send({ status: false, message: "No user found" });
    }

    // Find the property itself
    const foundProperty = user.property.id(id);
    if (!foundProperty) {
      return res
        .status(404)
        .send({ status: false, message: "Property not found" });
    }

    // 🟢 Increase the property views
    foundProperty.views = (foundProperty.views || 0) + 1;

    // Save updated user document (because property is nested)
    await user.save();

    // Send both property and user info
    res.send({
      status: true,
      message: "Property found successfully",
      property: foundProperty,
      user: {
        firstname: user.firstname,
        lastname: user.lastname,
        email: user.email,
        profileimage: user.profileimage,
        phone: user.phone,
        _id: user._id,
      },
    });
  } catch (err) {
    console.log(err);
    res.status(500).send({ status: false, message: "Internal server error" });
  }
};

const sendMail = async (req, res) => {
  const nodemailer = require("nodemailer");
  const { senderemail, message } = req.body;
  const { id } = req.params;

  try {
    // 🔍 1. Find property owner
    const user = await userModel.findOne({ "property._id": id });
    if (!user) {
      return res.status(404).send({ status: false, message: "No user found" });
    }

    // Owner’s email
    const agentEmail = user.email;

    // 🔧 2. Setup email transporter
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL,
        pass: process.env.APP_PASSWORD,
      },
    });

    // 📧 3. Create email content
    const mailOptions = {
      from: senderemail,
      to: agentEmail,
      subject: "Inquiry on your property",
      text: message,
    };

    // 📨 4. Send mail
    await transporter.sendMail(mailOptions);
    // 📊 5. Increment message count
    const foundProperty = user.property.id(id);
    foundProperty.messageCount = (foundProperty.messageCount || 0) + 1;
    await user.save();

    res.status(200).send({
      status: true,
      message: "Email sent successfully",
    });
  } catch (err) {
    console.error(err);
    res.status(500).send({
      status: false,
      message: "Error sending mail or updating count",
    });
  }
};

const sellProperty = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await userModel.findOne({ "property._id": id });
    const property = user.property.id(id);
    if (!property) {
      res.status(404).send({ status: false, message: "property not found" });
    }
    user.revenue = (user.revenue || 0) + property.price;
    property.soldDate = new Date();
    user.soldProperty.push(property);
    user.property = user.property.filter((p) => p._id.toString() !== id);
    res
      .status(200)
      .send({ status: true, message: "You have sold this property" });
    await user.save();
  } catch (err) {
    res.status(500).send({ status: false, message: "Internal server error" });
  }
};

const getData = async (req, res) => {
  const { id } = req.params;
  try {
    const user = await userModel.findById(id);
    let monthlyTotal = new Array(12).fill(0);
    user.soldProperty.forEach((item) => {
      const index = new Date(item.soldDate).getMonth();
      monthlyTotal[index] = user.revenue;
    });

    monthlyRevenue = [
      { month: "Jan", revenue: monthlyTotal[0] },
      { month: "Feb", revenue: monthlyTotal[1] },
      { month: "Mar", revenue: monthlyTotal[2] },
      { month: "Apr", revenue: monthlyTotal[3] },
      { month: "May", revenue: monthlyTotal[4] },
      { month: "Jun", revenue: monthlyTotal[5] },
      { month: "Jul", revenue: monthlyTotal[6] },
      { month: "Aug", revenue: monthlyTotal[7] },
      { month: "Sep", revenue: monthlyTotal[8] },
      { month: "Oct", revenue: monthlyTotal[9] },
      { month: "Nov", revenue: monthlyTotal[10] },
      { month: "Dec", revenue: monthlyTotal[11] },
    ];
    res.status(200).send({ status: true, rev: monthlyRevenue });
  } catch (err) {
    res.status(500).send({ status: false, message: "Internal server error" });
  }
};

const deleteProperty = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await userModel.findOne({ "property._id": id });
    console.log(id);
    console.log(user.property);
    user.property = user.property.filter((p) => p._id.toString() !== id);
    await user.save();

    res.status(200).send({ status: true, message: "Successfully deleted" });
  } catch (err) {
    console.log(err);
    res.status(500).send({ status: false, message: "Internal server error" });
  }
};

const deleteAcct = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await userModel.findByIdAndDelete(id);
    if (!user) {
      res.status(404).send({ status: false });
    }
    res
      .status(200)
      .send({ status: true, message: "Thanks for using this app 😊" });
  } catch (err) {}
};

const filterArray = async (req, res) => {
  let { type } = req.body;
  try {
    let all = await userModel.find();
    let matchedProperties = [];
    all.forEach((prop) => {
      let filtered = prop.property.filter(
        (p) => p.type.toLowerCase() === type.toLowerCase()
      );
      matchedProperties = matchedProperties.concat(filtered);
    });
    if (matchedProperties === 0) {
      res.send({ status: false, message: "No property found" });
    }
    if (matchedProperties) {
      res
        .status(200)
        .send({ status: true, matchedProperties, message: "Property found" });
    }
  } catch (err) {
    console.log(err);
  }
};

const editEmail = async(req,res)=>{
  const {id, email, oldEmail, prevEmail}= req.body

  try{
    const user = await userModel.findById(id)
    if(!user){
      return res.status(404).send({status:false,message:"no user found"})
    }
    if(oldEmail !== prevEmail){
      return res.send({status:false, message:"Incorrect email"})
    }
    user.email = email
    await user.save()
    res.status(200).send({status:true,messge:"Edited email successfully"})
  }catch(err){
    console.error(err);
    res.status(500).send({ status: false, message: "Internal server error" });
  }
}

const editPhone = async(req,res)=>{
  const {id, phone}= req.body
  try{
    const user = await userModel.findById(id)
    if(!user){
      return res.status(404).send({status:false,message:"no user found"})
    }
      user.phone = phone
      await user.save()
      res.status(200).send({status:true,messge:"Edited contact info"})
  }catch(err){
    console.error(err);
    res.status(500).send({ status: false, message: "Internal server error" });
  }
}
const editFirst = async(req,res)=>{
  const {id, firstname}= req.body

  try{
    const user = await userModel.findById(id)
    if(!user){
      return res.status(404).send({status:false,message:"no user found"})
    }
      user.firstname = firstname
      await user.save()
      res.status(200).send({status:true,messge:"Edited Firstname"})
  }catch(err){
    console.error(err);
    res.status(500).send({ status: false, message: "Internal server error" });
  }
}
const editLast = async(req,res)=>{
  const {id, lastname}= req.body

  try{
    const user = await userModel.findById(id)
    if(!user){
      return res.status(404).send({status:false,message:"no user found"})
    }
      user.lastname = lastname
      await user.save()
      res.status(200).send({status:true,messge:"Edited Lastname"})
  }catch(err){
    console.error(err);
    res.status(500).send({ status: false, message: "Internal server error" });
  }
}

const changePassword = async(req,res)=>{
  const {id} = req.params
  const {prevpassword,password} = req.body
  try{
    const user = await userModel.findById(id)
    if (!user) {
      return res.status(404).send({ status: false, message: "User not found" });
    }
    const match = bcrypt.compare(prevpassword,user.password)
    if(!match){
      return res.status(400).send({status:true, message:"Incorrect password"})
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    user.password = hashedPassword
    await user.save()

    res.status(200).send({status:true, message:"Password updated"})
    
  }catch(err){
  console.error(err);
  res.status(500).send({ status: false, message: "Internal server error" });
  }
}

module.exports = {
  registerUser,
  signIn,
  getDashboard,
  uploadProperty,
  getAllProperties,
  upload,
  saveProfileimage,
  getProduct,
  sendMail,
  sellProperty,
  getData,
  deleteProperty,
  deleteAcct,
  filterArray,
  editEmail,
  editPhone,
  editFirst,
  editLast,
  changePassword
};
