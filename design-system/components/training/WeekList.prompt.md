Use `WeekList` for the program overview.

```jsx
<WeekList
  days={[{label:"mon",done:true},{label:"wed",done:true},{label:"fri"},{label:"sat"}]}
  sessions={[
    {name:"lower · heavy", when:"mon · morning done", axis:"legs"},
    {name:"carry + core", when:"anytime", axis:"core"},
  ]}
/>
```

An "anytime" session is a first-class case, not an error state — it gets a row and no pill.
