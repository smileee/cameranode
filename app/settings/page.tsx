'use client';

import React, { useState, useEffect } from 'react';
import { CAMERAS } from '../../cameras.config';

type CameraSettings = {
  [key: string]: {
    dog: boolean;
    bird: boolean;
    person: boolean;
  };
};

const SettingsPage = () => {
  const [cameraSettings, setCameraSettings] = useState<CameraSettings>({});

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/settings');
        if (response.ok) {
          const data = await response.json();
          // Initialize settings for cameras not in the DB
          const initialSettings: CameraSettings = {};
          CAMERAS.forEach(camera => {
            initialSettings[camera.id] = data[camera.id] || { dog: false, bird: false, person: false };
          });
          setCameraSettings(initialSettings);
        } else {
          console.error('Failed to fetch settings');
        }
      } catch (error) {
        console.error('Error fetching settings:', error);
      }
    };

    fetchSettings();
  }, []);

  const handleToggle = async (cameraId: string, alertType: 'dog' | 'bird' | 'person') => {
    const newSettings = {
      ...cameraSettings,
      [cameraId]: {
        ...cameraSettings[cameraId],
        [alertType]: !cameraSettings[cameraId][alertType],
      },
    };
    setCameraSettings(newSettings);

    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newSettings),
      });
    } catch (error) {
      console.error('Failed to save settings:', error);
      // Optionally revert state on error
    }
  };

  const handleDisconnect = (cameraId: string) => {
    console.log(`Disconnecting camera ${cameraId}`);
    // Implement disconnect logic here
  };

  const handleEraseData = (cameraId: string) => {
    console.log(`Erasing data for camera ${cameraId}`);
    // Implement erase data logic here
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Settings</h1>
      <div className="space-y-4">
        {CAMERAS.map(camera => (
          <div key={camera.id} className="p-4 border rounded-lg">
            <h2 className="text-xl font-semibold">{camera.name}</h2>
            <div className="mt-2 space-y-2">
              <h3 className="font-medium">Alerts</h3>
              <div className="flex items-center justify-between">
                <span>Dog</span>
                <button
                  onClick={() => handleToggle(camera.id, 'dog')}
                  className={`px-4 py-2 rounded ${cameraSettings[camera.id]?.dog ? 'bg-green-500' : 'bg-gray-300'}`}
                >
                  {cameraSettings[camera.id]?.dog ? 'On' : 'Off'}
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span>Bird</span>
                <button
                  onClick={() => handleToggle(camera.id, 'bird')}
                  className={`px-4 py-2 rounded ${cameraSettings[camera.id]?.bird ? 'bg-green-500' : 'bg-gray-300'}`}
                >
                  {cameraSettings[camera.id]?.bird ? 'On' : 'Off'}
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span>Person</span>
                <button
                  onClick={() => handleToggle(camera.id, 'person')}
                  className={`px-4 py-2 rounded ${cameraSettings[camera.id]?.person ? 'bg-green-500' : 'bg-gray-300'}`}
                >
                  {cameraSettings[camera.id]?.person ? 'On' : 'Off'}
                </button>
              </div>
            </div>
            <div className="mt-4 flex space-x-2">
              <button
                onClick={() => handleDisconnect(camera.id)}
                className="bg-red-500 text-white px-4 py-2 rounded"
              >
                Disconnect
              </button>
              <button
                onClick={() => handleEraseData(camera.id)}
                className="bg-yellow-500 text-white px-4 py-2 rounded"
              >
                Erase Data
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SettingsPage; 