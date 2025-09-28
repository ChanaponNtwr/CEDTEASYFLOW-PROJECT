const router = require('express').Router()

router.use('/node', require('./node.controller'))

module.exports = router