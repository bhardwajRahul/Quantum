const express = require('express');
const router = express.Router();
const githubController = require('../controllers/github');
const githubMiddleware = require('../middlewares/github');
const authMiddleware = require('../middlewares/authentication');


router.use(authMiddleware.protect, authMiddleware.restrictTo('admin'));

router.get('/', githubMiddleware.authenticate);
router.get('/callback', githubMiddleware.authenticateCallback, githubController.authCallback);

router.route('/:id')
    .get(githubController.getAccount)
    .patch(githubController.updateAccount)
    .delete(githubController.deleteAccount);

router.route('/')
    .get(githubController.getAccounts)
    .post(githubController.createAccount);

module.exports = router;