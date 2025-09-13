// User Model - Function-based approach
// Mock database - In production, this would be replaced with actual database operations
let users = [
  { id: 1, name: 'John Doe', email: 'john@example.com', createdAt: new Date() },
  { id: 2, name: 'Jane Smith', email: 'jane@example.com', createdAt: new Date() },
  { id: 3, name: 'Alice Johnson', email: 'alice@example.com', createdAt: new Date() }
];
let nextId = 4;

// Helper functions
const validateUser = (userData) => {
  const errors = [];
  
  if (!userData.name || userData.name.trim().length < 2) {
    errors.push('Name must be at least 2 characters long');
  }
  
  if (!userData.email || !isValidEmail(userData.email)) {
    errors.push('Valid email is required');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const createUserObject = (id, name, email, createdAt = new Date()) => {
  return {
    id,
    name,
    email,
    createdAt
  };
};

// Model functions
const findAllUsers = () => {
  return users.map(user => ({ ...user }));
};

const findUserById = (id) => {
  const user = users.find(user => user.id === parseInt(id));
  return user ? { ...user } : null;
};

const createUser = (userData) => {
  const validation = validateUser(userData);
  if (!validation.isValid) {
    throw new Error(validation.errors.join(', '));
  }

  const newUser = createUserObject(
    nextId++,
    userData.name.trim(),
    userData.email.trim().toLowerCase()
  );
  
  users.push(newUser);
  return { ...newUser };
};

const updateUser = (id, userData) => {
  const userIndex = users.findIndex(user => user.id === parseInt(id));
  if (userIndex === -1) {
    return null;
  }

  const validation = validateUser(userData);
  if (!validation.isValid) {
    throw new Error(validation.errors.join(', '));
  }

  users[userIndex].name = userData.name.trim();
  users[userIndex].email = userData.email.trim().toLowerCase();
  
  return { ...users[userIndex] };
};

const deleteUser = (id) => {
  const userIndex = users.findIndex(user => user.id === parseInt(id));
  if (userIndex === -1) {
    return false;
  }

  users.splice(userIndex, 1);
  return true;
};

const findUserByEmail = (email) => {
  const user = users.find(user => user.email === email.toLowerCase());
  return user ? { ...user } : null;
};

// Export all functions
module.exports = {
  findAllUsers,
  findUserById,
  createUser,
  updateUser,
  deleteUser,
  findUserByEmail,
  validateUser,
  isValidEmail
};
