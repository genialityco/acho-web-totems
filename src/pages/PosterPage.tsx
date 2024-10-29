import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Card, Text } from '@mantine/core';

const PosterPage = () => {
  const { id } = useParams<{ id: string }>();
  const [poster, setPoster] = useState<{ title: string; description: string } | null>(null);

  useEffect(() => {
    const fetchPosterDetail = async () => {
      try {
        const response = await axios.get(`http://tu-backend.com/api/posters/${id}`);
        setPoster(response.data);
      } catch (error) {
        console.error('Error fetching poster detail:', error);
      }
    };

    fetchPosterDetail();
  }, [id]);

  if (!poster) return <Text>Cargando...</Text>;

  return (
    <Card shadow="sm" padding="lg">
      <Text size="xl">{poster.title}</Text>
      <Text>{poster.description}</Text>
    </Card>
  );
};

export default PosterPage;
