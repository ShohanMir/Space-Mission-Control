const axios = require('axios');

const launchesDatabase = require('./launches.mongo');
const planets = require('./planets.mongo');

// if there is no flight number exist in the database that's why created a default flight number and it start with 100
const DEFAULT_FLIGHT_NUMBER = 100;

// the info database structure
// const launch = {
//   flightNumber: 100,
//   mission: 'kepler Exploration X',
//   rocket: 'Explorer IS1',
//   launchDate: new Date('December 27, 2030'),
//   target: 'Kepler-442 b',
//   customers: ['NASA', 'SPACEX'],
//   upcoming: true,
//   success: true,
// };

// saveLaunch(launch);
// launches.set(launch.flightNumber, launch);

const SPACEX_API_URL = 'https://api.spacexdata.com/v4/launches/query';

async function populateLaunches() {
  console.log('Downloading launch data...');
  const response = await axios.post(SPACEX_API_URL, {
    query: {},
    options: {
      pagination: false,
      populate: [
        {
          path: 'rocket',
          select: {
            name: 1,
          },
        },
        {
          path: 'payloads',
          select: {
            customers: 1,
          },
        },
      ],
    },
  });

  if (response.status !== 200) {
    console.log('Problem downloading launching data!');
    throw new Error('Launch data download failed!');
  }

  const launchDocs = response.data.docs;
  for (const launchDoc of launchDocs) {
    const payloads = launchDoc['payloads'];
    const customers = payloads.flatMap((payload) => {
      return payload['customers'];
    });

    const launch = {
      flightNumber: launchDoc['flight_number'],
      mission: launchDoc['name'],
      rocket: launchDoc['rocket']['name'],
      launchDate: launchDoc['date_local'],
      upcoming: launchDoc['upcoming'],
      success: launchDoc['success'],
      customers,
    };

    console.log(`${launch.flightNumber} ${launch.mission}`);

    await saveLaunch(launch);
  }
}

async function loadLaunchData() {
  const firstLaunch = await findLaunch({
    flightNumber: 1,
    rocket: 'Falcon 1',
    mission: 'FalconSat',
  });
  if (firstLaunch) {
    console.log('Launch data already loaded!');
  } else {
    await populateLaunches();
  }
}
// existsLaunchWithId check if a launch id exist or not so based on that launch we can abort launch or find specific launch information

async function findLaunch(filter) {
  return await launchesDatabase.findOne(filter);
}

async function existsLaunchWithId(launchId) {
  return await findLaunch({
    flightNumber: launchId,
  });
}

// getLatesFlightNumber only get the latest flight number from mongo database and the flight number we are increasing using this functionn (getLatesFlightNumber + 1) in the scheduleNewLaunch function to make latest flight for new informaton.
async function getLatestFlightNumber() {
  const latestLaunch = await launchesDatabase.findOne().sort('-flightNumber');

  if (!latestLaunch) {
    return DEFAULT_FLIGHT_NUMBER;
  }

  return latestLaunch.flightNumber;
}

// getAllLaunches provide all the information provided by user and show it on upcomming launches tab from database
async function getAllLaunches(skip, limit) {
  // return Array.from(launches.values());
  return await launchesDatabase
    .find({}, { _id: 0, __v: 0 })
    .sort({ flightNumber: 1 })
    .skip(skip)
    .limit(limit);
}

// the saveLaunch function search the matching flight number and update the whole information with the new information
async function saveLaunch(launch) {
  await launchesDatabase.findOneAndUpdate(
    {
      flightNumber: launch.flightNumber,
    },
    launch,
    {
      upsert: true,
    }
  );
}

// scheduleNewLaunch function confirm the habitable planets is exist in our database or not and increase the flight number for new information assign new information using our built in data structure in the mongodb database
async function scheduleNewLaunch(launch) {
  const planet = await planets.findOne({
    keplerName: launch.target,
  });

  // confirm, if the provided planet is habitable planet or not and is it in our list (planet database) or not
  if (!planet) {
    throw new Error('No matching planet found');
  }
  // increasing the flight number
  const newFlightNumber = (await getLatestFlightNumber()) + 1;

  // assigning the new information with some prerequisite information
  const newLaunch = Object.assign(launch, {
    success: true,
    upcoming: true,
    customers: ['Zero to Mastery', 'NASA'],
    flightNumber: newFlightNumber,
  });

  // finally save the launches information
  await saveLaunch(newLaunch);
}
// function addNewLaunch(launch) {
//   latestFlightNumber++;
//   launches.set(
//     latestFlightNumber,
//     Object.assign(launch, {
//       success: true,
//       upcoming: true,
//       customers: ['NASA'],
//       flightNumber: latestFlightNumber,
//     })
//   );
// }

async function abortLaunchById(launchId) {
  const aborted = await launchesDatabase.updateOne(
    {
      flightNumber: launchId,
    },
    {
      upcoming: false,
      success: false,
    }
  );
  // const aborted = launches.get(launchId);
  // aborted.upcoming = false;
  // aborted.success = false;
  // return aborted.ok === 1 && aborted.nModified === 1;
  return aborted.modifiedCount === 1;
}

module.exports = {
  loadLaunchData,
  existsLaunchWithId,
  getAllLaunches,
  scheduleNewLaunch,
  abortLaunchById,
};
