<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import {
    Chart, LineElement, PointElement, LinearScale, CategoryScale,
    Tooltip, Legend, LineController, Filler,
  } from 'chart.js';
  import { formatMonth } from '../utils.js';

  Chart.register(LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend, LineController, Filler);

  let { data = [] } = $props();
  
  const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif';

  let labels = $derived(data.map(d => formatMonth(d.month)));
  let values = $derived(data.map(d => d.amount));

  let canvas;
  let chart;

  $effect(() => {
    const l = labels;
    const v = values;
    if (chart && l && v) {
      chart.data.labels = l;
      chart.data.datasets[0].data = v;
      chart.update();
    }
  });

  onMount(() => {
    chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: data.map(d => formatMonth(d.month)),
        datasets: [{
          label: 'Spending',
          data: data.map(d => d.amount),
          borderColor: '#f97316',
          backgroundColor: (context) => {
             const chart = context.chart;
             const {ctx, chartArea} = chart;
             if (!chartArea) return null;
             const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
             gradient.addColorStop(0, 'rgba(249, 115, 22, 0)');
             gradient.addColorStop(1, 'rgba(249, 115, 22, 0.15)');
             return gradient;
          },
          borderWidth: 3,
          pointRadius: 0,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: '#f97316',
          pointHoverBorderColor: '#fff',
          pointHoverBorderWidth: 2,
          tension: 0.4,
          fill: true,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: 'index',
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#18181b',
            titleFont: { family: FONT, size: 13, weight: 700 },
            bodyFont: { family: FONT, size: 12 },
            padding: 12,
            cornerRadius: 8,
            borderColor: '#27272a',
            borderWidth: 1,
            callbacks: {
              label: (ctx) => ` $${ctx.parsed.y.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
            },
          },
        },
        scales: {
          x: {
            ticks: {
              color: '#71717a',
              font: { family: FONT, size: 11, weight: 600 }
            },
            grid: { display: false },
            border: { display: false }
          },
          y: {
            ticks: {
              color: '#71717a',
              font: { family: FONT, size: 10, weight: 500 },
              padding: 10,
              callback: v => `$${v}`,
            },
            grid: { color: '#18181b' },
            border: { display: false },
            beginAtZero: true,
          },
        },
        animation: {
          duration: 1000,
          easing: 'easeOutQuart'
        }
      },
    });
  });

  onDestroy(() => { if (chart) chart.destroy(); });
</script>

<div class="chart-wrapper">
  <!-- svelte-ignore a11y_no_interactive_element_to_noninteractive_role -->
  <canvas bind:this={canvas} role="img" aria-label="Spending over time"></canvas>
</div>

<style>
  .chart-wrapper {
    width: 100%;
    height: 100%;
    position: relative;
  }
</style>
