import React, { useEffect, useState } from 'react';
import { Container, Table, TextInput, Title, Select, Divider } from '@mantine/core';
import { fetchSpeakers, Speaker } from '../services/api/speakerService';

const SpeakersList: React.FC = () => {
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [filter, setFilter] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    fetchSpeakers()
      .then((data: any) => {
        // Se asume que la respuesta trae los items en data.data.items o directamente en data
        const items = data.data?.items || data;
        setSpeakers(items);
      })
      .catch((error) => console.error('Error fetching speakers:', error))
      .finally(() => setIsLoading(false));
  }, []);

  // Filtrar por eventId en el frontend
  const filteredSpeakers = speakers.filter((speaker) =>
    speaker.eventId.toLowerCase().includes(filter.toLowerCase())
  );

  // Ordenar por eventId según el orden seleccionado
  const sortedSpeakers = [...filteredSpeakers].sort((a, b) => {
    if (sortOrder === 'asc') {
      return a.eventId.localeCompare(b.eventId);
    } else {
      return b.eventId.localeCompare(a.eventId);
    }
  });

  // Agrupar speakers por eventId
  const groupedSpeakers = sortedSpeakers.reduce((groups: { [key: string]: Speaker[] }, speaker) => {
    const key = speaker.eventId;
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(speaker);
    return groups;
  }, {});

  return (
    <Container>
      <Title order={2} mb="md">
        Listado de Speakers
      </Title>
      <TextInput
        placeholder="Filtrar por Event ID"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        mb="md"
      />
      <Select
        label="Ordenar por Event ID"
        placeholder="Selecciona orden"
        data={[
          { value: 'asc', label: 'Ascendente' },
          { value: 'desc', label: 'Descendente' },
        ]}
        value={sortOrder}
        onChange={(value) => setSortOrder(value as 'asc' | 'desc')}
        mb="md"
      />
      {isLoading ? (
        <p>Cargando...</p>
      ) : (
        // Se itera sobre cada grupo
        Object.keys(groupedSpeakers).map((eventId) => (
          <div key={eventId}>
            <Title order={4} mt="md">
              Event ID: {eventId}
            </Title>
            <Divider my="sm" />
            <Table highlightOnHover>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Descripción</th>
                  <th>Ubicación</th>
                </tr>
              </thead>
              <tbody>
                {groupedSpeakers[eventId].map((speaker) => (
                  <tr key={speaker._id}>
                    <td>{speaker.names}</td>
                    <td>{speaker.description}</td>
                    <td>{speaker.location}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        ))
      )}
    </Container>
  );
};

export default SpeakersList;
