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

const ToggleSwitch = ({ enabled, onChange }: { enabled: boolean; onChange: () => void }) => (
  <button
    type="button"
    className={`${
      enabled ? 'bg-blue-600' : 'bg-gray-200'
    } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
    onClick={onChange}
  >
    <span
      className={`${
        enabled ? 'translate-x-5' : 'translate-x-0'
      } inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
    />
  </button>
);

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
    <div className="bg-gray-100 min-h-screen">
      <div className="container mx-auto p-8">
        <h1 className="text-4xl font-bold text-gray-800 mb-8">Settings</h1>
        <div className="space-y-6">
          {CAMERAS.map(camera => (
            <div key={camera.id} className="bg-white p-6 rounded-xl shadow-md">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">{camera.name}</h2>
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-700">Alert Triggers</h3>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium text-gray-800">Person Detected</span>
                  <ToggleSwitch
                    enabled={cameraSettings[camera.id]?.person ?? false}
                    onChange={() => handleToggle(camera.id, 'person')}
                  />
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium text-gray-800">Dog Detected</span>
                  <ToggleSwitch
                    enabled={cameraSettings[camera.id]?.dog ?? false}
                    onChange={() => handleToggle(camera.id, 'dog')}
                  />
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium text-gray-800">Bird Detected</span>
                  <ToggleSwitch
                    enabled={cameraSettings[camera.id]?.bird ?? false}
                    onChange={() => handleToggle(camera.id, 'bird')}
                  />
                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-gray-200 flex space-x-3">
                <button
                  onClick={() => handleDisconnect(camera.id)}
                  className="bg-red-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-600 transition-colors"
                >
                  Disconnect
                </button>
                <button
                  onClick={() => handleEraseData(camera.id)}
                  className="bg-yellow-400 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:bg-yellow-500 transition-colors"
                >
                  Erase Data
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SettingsPage; 