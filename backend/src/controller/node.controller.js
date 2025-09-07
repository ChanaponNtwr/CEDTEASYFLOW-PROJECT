const router = require('express').Router()
const Context = require('../database/context')
const ContextN = require('../database/contextN')
const service = require('../service/node.service')

router.get('/input', (req, res) => {
    const context = new ContextN()
    const db = new Context()
    const result = new service(db, context).InputHandler("a", "c")
    res.send({message: result})
})
router.get('/flowchart', (req,res ) => {
    const context = new Context(node, edge)
    // const flow = new flowService()
})
module.exports = router