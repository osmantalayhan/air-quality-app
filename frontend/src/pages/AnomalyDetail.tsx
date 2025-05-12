import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  Divider,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import {
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
} from '@mui/lab';
import {
  ArrowBack as ArrowBackIcon,
  Timeline as TimelineIcon,
  Assessment as AssessmentIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { format } from 'date-fns';
import { useSnackbar } from '../contexts/SnackbarContext';

interface Anomaly {
  id: number;
  timestamp: string;
  type: string;
  severity: 'low' | 'medium' | 'high';
  status: 'active' | 'resolved';
  description: string;
  location: string;
  metrics: {
    name: string;
    value: string;
    unit: string;
  }[];
  timeline: {
    time: string;
    event: string;
  }[];
}

interface TimelineEvent {
  id: number;
  timestamp: string;
  title: string;
  description: string;
  type: 'detection' | 'alert' | 'action' | 'resolution';
}

const severityColors = {
  LOW: 'info',
  MEDIUM: 'warning',
  HIGH: 'error',
  CRITICAL: 'error',
};

const statusColors = {
  NEW: 'error',
  IN_PROGRESS: 'warning',
  RESOLVED: 'success',
};

const mockTimelineEvents: TimelineEvent[] = [
  {
    id: 1,
    timestamp: '2024-03-20T10:30:00',
    title: 'Anomaly Detected',
    description: 'System detected unusual temperature readings',
    type: 'detection',
  },
  {
    id: 2,
    timestamp: '2024-03-20T10:31:00',
    title: 'Alert Generated',
    description: 'High priority alert created and notifications sent',
    type: 'alert',
  },
  {
    id: 3,
    timestamp: '2024-03-20T10:45:00',
    title: 'Maintenance Dispatched',
    description: 'Maintenance team notified and dispatched to location',
    type: 'action',
  },
  {
    id: 4,
    timestamp: '2024-03-20T11:15:00',
    title: 'Issue Resolved',
    description: 'Temperature sensor calibrated and readings normalized',
    type: 'resolution',
  },
];

const getTimelineDotColor = (type: TimelineEvent['type']) => {
  switch (type) {
    case 'detection':
      return 'warning';
    case 'alert':
      return 'error';
    case 'action':
      return 'info';
    case 'resolution':
      return 'success';
    default:
      return 'grey';
  }
};

const mockAnomalyData: Anomaly = {
  id: 1,
  timestamp: '2024-03-20 10:30:00',
  type: 'Temperature',
  severity: 'high',
  status: 'active',
  description: 'Temperature exceeds threshold in Zone A',
  location: 'Building 3, Floor 2, Zone A',
  metrics: [
    { name: 'Temperature', value: '95', unit: '°F' },
    { name: 'Humidity', value: '65', unit: '%' },
    { name: 'Pressure', value: '1013', unit: 'hPa' },
  ],
  timeline: [
    { time: '2024-03-20 10:30:00', event: 'Anomaly detected' },
    { time: '2024-03-20 10:30:30', event: 'Alert triggered' },
    { time: '2024-03-20 10:31:00', event: 'Notification sent to operators' },
    { time: '2024-03-20 10:35:00', event: 'Investigation initiated' },
  ],
};

const AnomalyDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showMessage } = useSnackbar();
  const [anomaly, setAnomaly] = useState<Anomaly | null>(null);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [resolution, setResolution] = useState('');

  useEffect(() => {
    fetchAnomalyDetails();
  }, [id]);

  const fetchAnomalyDetails = async () => {
    try {
      const [anomalyResponse, eventsResponse] = await Promise.all([
        axios.get(`/api/v1/anomalies/${id}`),
        axios.get(`/api/v1/anomalies/${id}/events`),
      ]);
      setAnomaly(anomalyResponse.data);
      setEvents(eventsResponse.data);
    } catch (error) {
      showMessage('Anomali detayları yüklenirken bir hata oluştu.', 'error');
      navigate('/anomalies');
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async () => {
    try {
      await axios.post(`/api/v1/anomalies/${id}/resolve`, {
        resolution,
      });
      showMessage('Anomali başarıyla çözüldü.', 'success');
      setResolveDialogOpen(false);
      fetchAnomalyDetails();
    } catch (error) {
      showMessage('Anomali çözülürken bir hata oluştu.', 'error');
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!anomaly) {
    return null;
  }

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

  return (
    <Box sx={{ p: 3 }}>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate('/anomalies')}
        sx={{ mb: 3 }}
      >
        Back to Anomalies
      </Button>

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h4">
                Anomaly #{id}
              </Typography>
              <Chip
                label={anomaly.status.toUpperCase()}
                color={anomaly.status === 'active' ? 'error' : 'success'}
              />
            </Box>
            <Divider sx={{ my: 2 }} />
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" color="text.secondary">Type</Typography>
                <Typography variant="body1">{anomaly.type}</Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" color="text.secondary">Severity</Typography>
                <Chip
                  label={anomaly.severity.toUpperCase()}
                  color={getSeverityColor(anomaly.severity) as any}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" color="text.secondary">Location</Typography>
                <Typography variant="body1">{anomaly.location}</Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" color="text.secondary">Timestamp</Typography>
                <Typography variant="body1">{anomaly.timestamp}</Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle1" color="text.secondary">Description</Typography>
                <Typography variant="body1">{anomaly.description}</Typography>
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <AssessmentIcon sx={{ mr: 1 }} />
                <Typography variant="h6">Metrics</Typography>
              </Box>
              <List>
                {anomaly.metrics.map((metric, index) => (
                  <ListItem key={index} divider={index < anomaly.metrics.length - 1}>
                    <ListItemText
                      primary={metric.name}
                      secondary={`${metric.value} ${metric.unit}`}
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <TimelineIcon sx={{ mr: 1 }} />
                <Typography variant="h6">Timeline</Typography>
              </Box>
              <List>
                {anomaly.timeline.map((event, index) => (
                  <ListItem key={index} divider={index < anomaly.timeline.length - 1}>
                    <ListItemText
                      primary={event.event}
                      secondary={event.time}
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Timeline
        </Typography>
        <Timeline>
          {mockTimelineEvents.map((event, index) => (
            <TimelineItem key={event.id}>
              <TimelineSeparator>
                <TimelineDot color={getTimelineDotColor(event.type)} />
                {index < mockTimelineEvents.length - 1 && <TimelineConnector />}
              </TimelineSeparator>
              <TimelineContent>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2">
                    {format(new Date(event.timestamp), 'PPpp')}
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {event.title}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    {event.description}
                  </Typography>
                </Box>
              </TimelineContent>
            </TimelineItem>
          ))}
        </Timeline>

        <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
          <Button variant="contained" color="primary">
            Update Status
          </Button>
          <Button variant="outlined" color="secondary">
            Add Note
          </Button>
        </Box>
      </Paper>

      <Dialog open={resolveDialogOpen} onClose={() => setResolveDialogOpen(false)}>
        <DialogTitle>Anomaliyi Çöz</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Çözüm Açıklaması"
            type="text"
            fullWidth
            multiline
            rows={4}
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResolveDialogOpen(false)}>İptal</Button>
          <Button onClick={handleResolve} variant="contained" color="primary">
            Çözüldü Olarak İşaretle
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AnomalyDetail; 