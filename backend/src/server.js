const express = require('express')
const app = express()
const cors = require('cors')
const morgan = require('morgan')

require('dotenv').config()

app.use(cors())
app.use(morgan("dev"))

app.use('/', require('./controller'))


app.listen(process.env.PORT || 8080, () => console.log(`http://localhost:${process.env.PORT}`) )