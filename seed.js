const mongoose = require('mongoose');
require('dotenv').config();

const planetData = [
  {
    name: 'Mercury',
    id: 1,
    description: 'Closest planet to the sun.',
    image: 'https://upload.wikimedia.org/wikipedia/commons/4/4a/Mercury_in_true_color.jpg',
    velocity: '47.87 km/s',
    distance: '57.9 million km',
  },
  {
    name: 'Venus',
    id: 2,
    description: 'Second planet from the sun.',
    image: 'https://upload.wikimedia.org/wikipedia/commons/e/e5/Venus-real_color.jpg',
    velocity: '35.02 km/s',
    distance: '108.2 million km',
  },
  {
    name: 'Earth',
    id: 3,
    description: 'Our home planet.',
    image: 'https://upload.wikimedia.org/wikipedia/commons/9/97/The_Earth_seen_from_Apollo_17.jpg',
    velocity: '29.78 km/s',
    distance: '149.6 million km',
  },
  {
    name: 'Mars',
    id: 4,
    description: 'The red planet.',
    image: 'https://upload.wikimedia.org/wikipedia/commons/0/02/OSIRIS_Mars_true_color.jpg',
    velocity: '24.07 km/s',
    distance: '227.9 million km',
  },
  {
    name: 'Jupiter',
    id: 5,
    description: 'The largest planet in our solar system.',
    image: 'https://upload.wikimedia.org/wikipedia/commons/e/e2/Jupiter.jpg',
    velocity: '13.07 km/s',
    distance: '778.5 million km',
  },
  {
    name: 'Saturn',
    id: 6,
    description: 'Famous for its rings.',
    image: 'https://upload.wikimedia.org/wikipedia/commons/c/c7/Saturn_during_Equinox.jpg',
    velocity: '9.69 km/s',
    distance: '1.43 billion km',
  },
  {
    name: 'Uranus',
    id: 7,
    description: 'An ice giant with a tilted rotation.',
    image: 'https://upload.wikimedia.org/wikipedia/commons/3/3d/Uranus2.jpg',
    velocity: '6.81 km/s',
    distance: '2.87 billion km',
  },
  {
    name: 'Neptune',
    id: 8,
    description: 'The farthest planet from the sun.',
    image: 'https://upload.wikimedia.org/wikipedia/commons/5/56/Neptune_Full.jpg',
    velocity: '5.43 km/s',
    distance: '4.5 billion km',
  },
];

const planetSchema = new mongoose.Schema({
  name: String,
  id: Number,
  description: String,
  image: String,
  velocity: String,
  distance: String,
});

const Planet = mongoose.model('planets', planetSchema);

async function seedDatabase() {
  try {
    console.log('🌐 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI, {
      user: process.env.MONGO_USERNAME,
      pass: process.env.MONGO_PASSWORD,
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('🔄 Clearing existing data...');
    await Planet.deleteMany({});

    console.log('🌱 Inserting planet data...');
    await Planet.insertMany(planetData);

    console.log('✅ Database seeded successfully!');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
  } finally {
    mongoose.connection.close();
  }
}

seedDatabase();