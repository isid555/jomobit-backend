const verifyN8NRequestKey = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const token = authHeader.split(' ')[1];
    if (token !== process.env.N8N_REQUEST_KEY) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    next();
}

module.exports = { verifyN8NRequestKey };