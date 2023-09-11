import 'dotenv/config'
import express from "express";
import bodyParser from "body-parser";
import mongoose from "mongoose";
import session from 'express-session';
import passport from 'passport';
import passportLocalMongoose from "passport-local-mongoose"
import { getDate } from "./date.js";

const app = express();

app.set("view engine", "ejs")

app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb+srv://capslockdemo:"+process.env.PASSWORD+"@cluster0.1y34g0p.mongodb.net/petDB")
    .then(() => {
        console.log("Connected to the Database");
    })
    .catch((err) => {
        console.log(err);
    });

const userschema = new mongoose.Schema({
    username: String,
    password: String,
    firstname: String,
    lastname: String,
    job: String,
    dob: String,
    salary: Number,
    limit: Number
});

userschema.plugin(passportLocalMongoose);

const User = mongoose.model("User", userschema);

passport.use(User.createStrategy());

passport.serializeUser(User.serializeUser());

passport.deserializeUser(User.deserializeUser());

const expenseschema = new mongoose.Schema({
    user: String,
    expensedate: Date,
    expensename: String,
    category: String,
    amount: Number
})

const Expense = mongoose.model("Expense", expenseschema);


app.route("/")
    .get((req, res) => {
        res.render("index");
    });

app.route("/register")
    .get((req, res) => {
        res.render("register");
    })
    .post((req, res) => {
        User.register({ username: req.body.username }, req.body.password, (err, user) => {
            if (err) {
                console.log(err.message);
                res.render("register", { err: err.message });
            } else {
                passport.authenticate("local")(req, res, () => {
                    console.log("Successfully registered :)");
                    res.redirect("/info");
                });
            }
        });
    });

app.route("/info")
    .get((req, res) => {
        if (req.isAuthenticated()) {
            res.render("information");
        } else {
            res.render("login")
        }
    })
    .post(async (req, res) => {
        await User.findByIdAndUpdate(req.user.id, {
            firstname: req.body.fname,
            lastname: req.body.lname,
            job: req.body.job,
            dob: req.body.dob,
            salary: req.body.salary,
            limit: req.body.limit
        });
        res.redirect("/dashboard");

    })

app.route("/profile")
    .get(async (req, res) => {
        if (req.isAuthenticated()) {
            const user = await User.findById(req.user.id)
            res.render("profile", { user: user })
        } else {
            res.redirect("/login");
        }

    })

    .post(async (req, res) => {
        await User.findByIdAndUpdate(req.user.id, {
            firstname: req.body.fname,
            lastname: req.body.lname,
            job: req.body.job,
            dob: req.body.dob,
            salary: req.body.salary,
            limit: req.body.limit
        });
        res.redirect("/profile");
    })

app.get("/dashboard", async (req, res) => {
    if (req.isAuthenticated()) {
        const transcations = await Expense.aggregate([
            { $match: { user: req.user.id } },
            { $project: { expyear: { $year: "$expensedate" }, expmonth: { $month: "$expensedate" }, expdate: { $dayOfMonth: "$expensedate" }, expensename: 1, amount: 1 } },
            { $sort: { expmonth: -1 , expdate: -1 } }
        ]).exec();

        const userDetail = await User.findOne({ _id: req.user.id }, "salary firstname lastname job")
        // console.log(userDetail)

        const totalExpenses = await Expense.aggregate([
            { $match: { user: req.user.id } }, // filter by user
            { $group: { _id: "$user", total: { $sum: "$amount" } } } // group by user and sum amount
        ]);

        //   console.log (totalExpenses);

        // console.log(transcations);

        const graphData = await Expense.aggregate([
            { $match: { user: req.user.id } },
            { $group: { _id: { month: { $month: "$expensedate" } }, total: { $sum: "$amount" } } },
            { $sort: { _id: 1 } }
        ])

        const thisMonth = (new Date().getMonth()) + 1;

        const categoryGraph = await Expense.aggregate([
            { $match: { user: req.user.id } },
            {
                $project: {
                    category: 1,
                    amount: 1,
                    expmonth: { $month: "$expensedate" }
                }
            },
            { $match: { expmonth: { $eq: thisMonth } } },
            {
                $group: {
                    _id: "$category",
                    total: { $sum: "$amount" },

                }
            }
        ])

        res.render("dashboard", { transcations: transcations, userdetail: userDetail, totalexpense: totalExpenses, graphData: graphData, categoryData: categoryGraph });
    } else {
        res.redirect("/login");
    }

})

app.route("/expense")
    .get(async (req, res) => {
        if (req.isAuthenticated()) {
            const expensedata = await Expense.aggregate([
                { $match: { user: req.user.id } },
                { $project: { expdate: { $dayOfMonth: "$expensedate" }, expensename: 1, amount: 1, category: 1 } },
                { $match: { expdate: { $eq: new Date().getDate() } } }
            ]).exec();
            // console.log(expensedata);
            const today = getDate();
            res.render("expense", { expenses: expensedata, date: today });
            // console.log(getDate());
        } else {
            res.redirect("/login")
        }

    })
    .post(async (req, res) => {

        const expense = new Expense({
            user: req.user.id,
            expensedate: new Date(),
            expensename: req.body.expensename,
            category: req.body.category,
            amount: req.body.amount
        });

        const amount = Number(req.body.amount);

        await User.findByIdAndUpdate(req.user.id, {
            $inc: { salary: -amount } // subtracts 200 from the salary field
        });

        // console.log(expense);
        expense.save()
            .then(async () => {
                console.log("Expense added successfully");
                const msg = "Expense added successfully";
                const today = getDate();
                const expensedata = await Expense.aggregate([
                    { $match: { user: req.user.id } },
                    { $project: { expdate: { $dayOfMonth: "$expensedate" }, expensename: 1, amount: 1, category: 1 } },
                    { $match: { expdate: { $eq: new Date().getDate() } } }
                ]).exec();
                res.render("expense", { msg: msg, date: today, expenses: expensedata })
            })
    })

app.route("/analytics")
    .get(async (req, res) => {
        if (req.isAuthenticated()) {
            const graphData = await Expense.aggregate([
                { $match: { user: req.user.id } },
                { $group: { _id: { month: { $month: "$expensedate" } }, total: { $sum: "$amount" } } },
                { $sort: { _id: 1 } }
            ]);

            const categoryGraph = await Expense.aggregate([
                { $match: { user: req.user.id } },
                {
                    $project: {
                        category: 1,
                        amount: 1,
                        expmonth: { $month: "$expensedate" }
                    }
                },
                { $match: { expmonth: { $eq: (new Date().getMonth()) + 1 } } },
                {
                    $group: {
                        _id: "$category",
                        total: { $sum: "$amount" },

                    }
                }
            ]);

            const dailygraphData = await Expense.aggregate([
                { $match: { user: req.user.id } },
                { $group: { _id: { month: { $month: "$expensedate" }, day: { $dayOfMonth: "$expensedate" } }, total: { $sum: "$amount" } } },
                { $sort: { _id: 1 } }
            ]);

            res.render("analytics", { graphData: graphData, categoryData: categoryGraph, dailygraphData: dailygraphData })
        } else {
            res.redirect("/login")
        }
    })

app.route("/report")
    .get(async (req, res) => {
        if (req.isAuthenticated()) {
            const transcations = await Expense.aggregate([
                { $match: { user: req.user.id } },
                { $project: { expyear: { $year: "$expensedate" }, expmonth: { $month: "$expensedate" }, expdate: { $dayOfMonth: "$expensedate" }, expensename: 1, amount: 1 } },
                { $sort: { expmonth: -1 , expdate: -1 } }
            ]).exec();
            res.render("report", { transcations: transcations })
        } else {
            res.redirect("/login")
        }
    })


app.route("/login")
    .get((req, res) => {
        res.render("login", { err: req.session.messages });
    })
    .post(passport.authenticate("local",
        {
            successRedirect: "/dashboard",
            failureRedirect: "/login",
            failureMessage: "Invalid username or password"
        }));

app.get("/logout", (req, res) => {
    req.logout((err) => {
        if (err) {
            console.log(err);
        } else {
            console.log("Successfully Logged-out");
            res.redirect("/login");
        }
    })
});

app.listen(process.env.PORT, () => {
    console.log("Server is up and running :)")
});