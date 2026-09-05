Use `DayPills` at the top of the week view.

```jsx
<DayPills days={[{label:"mon",done:true},{label:"wed",done:true},{label:"fri"},{label:"sat"}]} />
```

Only list the days the program actually uses — an "anytime" session has no pill, it lives in the list below.
