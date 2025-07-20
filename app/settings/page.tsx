'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { IconArrowLeft } from '@tabler/icons-react';
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
      enabled ? 'bg-blue-500' : 'bg-muted'
    } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-black`}
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
    <div className="bg-background text-foreground min-h-screen">
      <div className="container mx-auto p-8">
        <header className="mb-12">
          <Link href="/" className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors mb-4">
            <IconArrowLeft size={18} className="mr-2" />
            Back to Cameras
          </Link>
          <h1 className="text-4xl font-bold">Settings</h1>
        </header>

        <div className="max-w-2xl mx-auto space-y-8">
          {CAMERAS.map(camera => (
            <div key={camera.id} className="bg-muted/50 p-6 rounded-lg border border-border">
              <h2 className="text-xl font-semibold mb-4">{camera.name}</h2>
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Alert Triggers</h3>
                <div className="flex items-center justify-between p-4 bg-muted rounded-md">
                  <span className="font-medium">Person Detected</span>
                  <ToggleSwitch
                    enabled={cameraSettings[camera.id]?.person ?? false}
                    onChange={() => handleToggle(camera.id, 'person')}
                  />
                </div>
                <div className="flex items-center justify-between p-4 bg-muted rounded-md">
                  <span className="font-medium">Dog Detected</span>
                  <ToggleSwitch
                    enabled={cameraSettings[camera.id]?.dog ?? false}
                    onChange={() => handleToggle(camera.id, 'dog')}
                  />
                </div>
                <div className="flex items-center justify-between p-4 bg-muted rounded-md">
                  <span className="font-medium">Bird Detected</span>
                  <ToggleSwitch
                    enabled={cameraSettings[camera.id]?.bird ?? false}
                    onChange={() => handleToggle(camera.id, 'bird')}
                  />
                </div>
              </div>
              <div className="mt-6 pt-6 border-t border-border flex space-x-3">
                <button
                  onClick={() => handleDisconnect(camera.id)}
                  className="btn bg-red-800/20 border-red-800 text-red-400 hover:bg-red-800/40"
                >
                  Disconnect
                </button>
                <button
                  onClick={() => handleEraseData(camera.id)}
                  className="btn bg-yellow-800/20 border-yellow-800 text-yellow-400 hover:bg-yellow-800/40"
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