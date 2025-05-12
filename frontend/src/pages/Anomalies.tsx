import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  IconButton,
  Typography,
  TextField,
  InputAdornment,
} from '@mui/material';
import {
  Search as SearchIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';

interface Anomaly {
  id: number;
  timestamp: string;
  type: string;
  severity: 'low' | 'medium' | 'high';
  status: 'active' | 'resolved';
  description: string;
}

const mockAnomalies: Anomaly[] = [
  {
    id: 1,
    timestamp: '2024-03-20 10:30:00',
    type: 'Temperature',
    severity: 'high',
    status: 'active',
    description: 'Temperature exceeds threshold in Zone A',
  },
  {
    id: 2,
    timestamp: '2024-03-20 09:15:00',
    type: 'Pressure',
    severity: 'medium',
    status: 'active',
    description: 'Pressure drop detected in Sector B',
  },
  {
    id: 3,
    timestamp: '2024-03-19 15:45:00',
    type: 'Vibration',
    severity: 'low',
    status: 'resolved',
    description: 'Unusual vibration patterns in Machine 3',
  },
  // Add more mock data as needed
];

const Anomalies: React.FC = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [searchQuery, setSearchQuery] = useState('');

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleViewAnomaly = (id: number) => {
    navigate(`/anomalies/${id}`);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'error';
      case 'medium':
        return 'warning';
      case 'low':
        return 'info';
      default:
        return 'default';
    }
  };

  const getStatusColor = (status: string) => {
    return status === 'active' ? 'error' : 'success';
  };

  const filteredAnomalies = mockAnomalies.filter((anomaly) =>
    Object.values(anomaly).some((value) =>
      value.toString().toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Anomalies
      </Typography>
      
      <Box sx={{ mb: 3 }}>
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Search anomalies..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Timestamp</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Severity</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredAnomalies
              .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
              .map((anomaly) => (
                <TableRow key={anomaly.id}>
                  <TableCell>{anomaly.id}</TableCell>
                  <TableCell>{anomaly.timestamp}</TableCell>
                  <TableCell>{anomaly.type}</TableCell>
                  <TableCell>
                    <Chip
                      label={anomaly.severity.toUpperCase()}
                      color={getSeverityColor(anomaly.severity) as any}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={anomaly.status.toUpperCase()}
                      color={getStatusColor(anomaly.status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{anomaly.description}</TableCell>
                  <TableCell>
                    <IconButton
                      onClick={() => handleViewAnomaly(anomaly.id)}
                      color="primary"
                      size="small"
                    >
                      <VisibilityIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={filteredAnomalies.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </TableContainer>
    </Box>
  );
};

export default Anomalies; 