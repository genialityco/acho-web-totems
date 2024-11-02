import { useState } from 'react';
import { PosterList } from '../components/PosterList';
import { Button } from '@mantine/core';

const HomePage = () => {
  const [showScreensaver, setShowScreensaver] = useState(false);

  const handleContainerClick = () => {
    setShowScreensaver(false);
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Button
        style={{ position: 'fixed', top: 10, left: 10, zIndex: 10, opacity: 0}}
        onClick={() => setShowScreensaver(!showScreensaver)}
      >
        {showScreensaver ? 'Cambiar' : 'Cambiar'}
      </Button>

      {showScreensaver ? (
        <div
          onClick={handleContainerClick}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'black',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            cursor: 'pointer',
            zIndex: 5,
          }}
        >
          <video
            src="/savescreen.mp4"
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
      ) : (
        <PosterList />
      )}
    </div>
  );
};

export default HomePage;
