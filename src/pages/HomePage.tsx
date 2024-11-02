import { useState } from "react";
import { PosterList } from "../components/PosterList";
import { Button } from "@mantine/core";

const HomePage = () => {
  const [showScreensaver, setShowScreensaver] = useState(false);

  const handleContainerClick = () => {
    setShowScreensaver(false);
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <Button
        style={{ position: "fixed", top: 10, left: 10, zIndex: 10, opacity: 0 }}
        onClick={() => setShowScreensaver(!showScreensaver)}
      >
        {showScreensaver ? "Cambiar" : "Cambiar"}
      </Button>

      {showScreensaver ? (
        <div
          onClick={handleContainerClick}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "black",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            cursor: "pointer",
            zIndex: 5,
          }}
        >
          <video
            src="https://player.vimeo.com/progressive_redirect/playback/1025723938/rendition/540p/file.mp4?loc=external&signature=6ecb5e47c267c218aab343f5d2a3ffbf4dd6aac3bcef39501d560021d10610fe"
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
            {/* <iframe
              src="https://player.vimeo.com/progressive_redirect/download/1025723938/rendition/1080p/savescreen%20%281080p%29.mp4?loc=external&signature=da348432ea79c7bc9e20596c70b3d28c97c9d11f1b94af02677489f8aa5aab59"
              allow="autoplay; fullscreen; picture-in-picture; clipboard-write"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              title="savescreen"
            ></iframe> */}
        </div>
      ) : (
        <PosterList />
      )}
    </div>
  );
};

export default HomePage;
