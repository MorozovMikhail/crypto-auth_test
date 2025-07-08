import React from 'react';
import { Container, Box, Paper } from '@mui/material';
import EcpAuth from './components/EcpAuth';

function App() {
  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 4 }}>
        <Paper elevation={3} sx={{ p: 4 }}>
          <EcpAuth />
        </Paper>
      </Box>
    </Container>
  );
}

export default App; 