export function requireDoctorRole(req, res, next) {
  const role = req.header('x-user-role') || 'guest';
  req.userRole = role;

  if (role !== 'doctor') {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Only users with doctor role can generate or save clinical notes.',
    });
  }

  return next();
}

export function attachRole(req, _res, next) {
  req.userRole = req.header('x-user-role') || 'guest';
  return next();
}
